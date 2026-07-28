import { Router } from 'express';
import { isDbConfigured } from '../../db/pool';
import { withSystem } from '../../db/withTenant';
import { hashToken } from '../../lib/invitations';
import { setAccountPassword } from '../../lib/authAccount';

/**
 * Rotas públicas de apoio ao login (sem autenticação).
 * Resolve a matrícula para o e-mail da conta, permitindo login por matrícula
 * (alunos/responsáveis e funcionários) enquanto o provedor de auth usa e-mail.
 */
export const publicAuthRouter = Router();

/** Mascara um e-mail para exibição segura (não confirma o endereço completo). */
function maskEmail(email: string): string {
  const [user, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${user.slice(0, 1)}***@${domain}`;
}

/**
 * GET /api/public/invite/:token
 * Valida um token de convite e devolve o estado (para a tela de aceite).
 * O token é o próprio segredo (256 bits) — só quem tem o link chega aqui.
 */
publicAuthRouter.get('/invite/:token', async (req, res) => {
  const raw = String(req.params.token ?? '');
  if (!raw || !isDbConfigured) return res.json({ ok: true, data: { valid: false } });

  const data = await withSystem(async (c) => {
    const r = await c.query(
      `select i.status, i.expires_at, i.purpose, i.email, p.name
         from public.user_invitations i
         join public.profiles p on p.id = i.profile_id
        where i.token_hash = $1 limit 1`,
      [hashToken(raw)],
    );
    if (r.rows.length === 0) return { valid: false as const };
    const row = r.rows[0];
    const expired = new Date(row.expires_at).getTime() <= Date.now();
    if (row.status !== 'pending') return { valid: false as const, state: row.status };
    if (expired) return { valid: false as const, state: 'expired' };
    return {
      valid: true as const,
      purpose: row.purpose,
      name: row.name as string,
      email_masked: maskEmail(row.email),
    };
  });
  res.json({ ok: true, data });
});

/**
 * POST /api/public/invite/accept  { token, password }
 * Consome o convite (uso único): define a senha real escolhida pelo usuário no
 * provedor de auth, marca o convite como aceito e ativa o acesso. Idempotência
 * negativa: um token já usado/expirado é rejeitado.
 */
publicAuthRouter.post('/invite/accept', async (req, res) => {
  const raw = String(req.body?.token ?? '');
  const password = String(req.body?.password ?? '');
  if (!raw) return res.status(400).json({ code: 'invalid_token', message: 'Convite inválido.' });
  if (password.length < 8) {
    return res.status(400).json({ code: 'weak_password', message: 'A senha deve ter ao menos 8 caracteres.' });
  }
  if (!isDbConfigured) return res.status(503).json({ code: 'db_unavailable' });

  try {
    const result = await withSystem(async (c) => {
      // Trava a linha do convite para evitar corrida de duplo-aceite.
      const r = await c.query(
        `select i.id, i.school_id, i.profile_id, i.auth_user_id, i.email, i.status, i.expires_at
           from public.user_invitations i
          where i.token_hash = $1
          for update`,
        [hashToken(raw)],
      );
      if (r.rows.length === 0) return { error: 'invalid_token' as const };
      const inv = r.rows[0];
      if (inv.status !== 'pending') return { error: 'used' as const };
      if (new Date(inv.expires_at).getTime() <= Date.now()) {
        await c.query(`update public.user_invitations set status='expired' where id=$1`, [inv.id]);
        return { error: 'expired' as const };
      }

      // Define a senha REAL no provedor (Better Auth) — o hash antigo (aleatório
      // ou revogado) é sobrescrito. A senha em claro nunca é persistida.
      const ok = await setAccountPassword(c, inv.auth_user_id, password);
      if (!ok) return { error: 'no_credential' as const };

      await c.query(
        `update public.user_invitations set status='accepted', accepted_at=now() where id=$1`,
        [inv.id],
      );
      await c.query(
        `update public.profiles set access_activated_at=now(), password_change_required=false where id=$1`,
        [inv.profile_id],
      );
      await c.query(
        `insert into public.invitation_audit_log (school_id, invitation_id, action, target_email)
         values ($1, $2, 'accepted', $3)`,
        [inv.school_id, inv.id, inv.email],
      );
      return { email: inv.email as string };
    });

    if ('error' in result && result.error) {
      const map: Record<string, { http: number; message: string }> = {
        invalid_token:  { http: 400, message: 'Convite inválido.' },
        used:           { http: 409, message: 'Este convite já foi utilizado. Solicite um novo à escola.' },
        expired:        { http: 410, message: 'Convite expirado. Solicite um novo à escola.' },
        no_credential:  { http: 400, message: 'Conta de acesso não encontrada. Contate a escola.' },
      };
      const m = map[result.error] ?? { http: 400, message: 'Não foi possível ativar o acesso.' };
      return res.status(m.http).json({ code: result.error, message: m.message });
    }

    res.json({ ok: true, data: { email: (result as any).email } });
  } catch (err: any) {
    console.error('[public.invite.accept] erro:', err?.message ?? err);
    res.status(500).json({ code: 'accept_failed', message: 'Falha ao ativar o acesso.' });
  }
});

publicAuthRouter.get('/login-email', async (req, res) => {
  const matricula = String(req.query.matricula ?? '').trim();
  if (!matricula) return res.status(400).json({ code: 'missing_matricula' });
  if (!isDbConfigured) return res.status(503).json({ code: 'db_unavailable' });

  // Pré-autenticação (sem escola no contexto) → contexto de sistema.
  const email = await withSystem(async (c) => {
    // Matrícula de aluno → e-mail do responsável (login do aluno).
    const student = await c.query(
      `select g.email
         from public.students s
         join public.guardians g on g.id = s.guardian_id
        where s.registration_number = $1
        limit 1`,
      [matricula],
    );
    if (student.rows[0]?.email) return student.rows[0].email as string;

    // Matrícula de funcionário → e-mail do funcionário.
    const staff = await c.query(
      `select email from public.teachers where registration_number = $1 limit 1`,
      [matricula],
    );
    return (staff.rows[0]?.email as string | undefined) ?? null;
  });

  if (email) return res.json({ ok: true, data: { email } });
  return res.status(404).json({ code: 'not_found', message: 'Matrícula não encontrada.' });
});
