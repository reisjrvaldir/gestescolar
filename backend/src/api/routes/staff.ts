import { Router } from 'express';
import { randomBytes, scryptSync } from 'crypto';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { signUpGuardian } from '../../lib/authSignup';
import { DEFAULT_GUARDIAN_PASSWORD, toStoredPassword } from '../../lib/validation';
import { validateBody } from '../../lib/validateBody';
import { audit } from '../../lib/audit';
import { staffCreateSchema, staffUpdateSchema } from '../../../../shared/schemas';

/**
 * Hash de senha no formato do Better Auth (Neon Auth): scrypt N=16384 r=16 p=1
 * dkLen=64, salt de 16 bytes em hex usado como string, saída "salt:hash" (hex).
 * Compatível com a verificação do provedor — permite resetar a senha de um
 * usuário direto na tabela neon_auth.account sem API administrativa.
 */
function betterAuthHash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password.normalize('NFKC'), salt, 64, {
    N: 16384, r: 16, p: 1, maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${key.toString('hex')}`;
}

export const staffRouter = Router();

staffRouter.use(requireAuth);

staffRouter.get('/', requireRole('school_admin', 'financial', 'teacher', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    // Dados pessoais sempre mascarados nas listagens — revelação via /personal-data/reveal
    const { rows } = await c.query(
      `select id, name,
              left(email,1) || '***@' || split_part(email,'@',2)                          as email,
              case when phone is null then null else '(**) ****-' || right(phone,4) end    as phone,
              '***.***.***-' || right(cpf,2)                                               as cpf,
              registration_number, role_type, subject_teaches,
              position, admission_date::text as admission_date, contract_type,
              weekly_hours::float8 as weekly_hours,
              coalesce(timeclock_enabled, true) as timeclock_enabled,
              status, created_at, user_id
         from public.teachers
        where school_id = $1
        order by name asc`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /:id/full — dados completos para pré-popular o formulário de edição.
// Restrito a school_admin/superadmin e registrado em audit_logs. A listagem
// pública já mascara CPF/e-mail/telefone; este endpoint devolve os valores
// reais especificamente para o formulário — evita que o gestor precise
// redigitar tudo do zero ao apenas ajustar o cargo ou a carga horária.
staffRouter.get('/:id/full', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, name, email, phone, cpf, registration_number, role_type, subject_teaches,
              position, admission_date::text as admission_date, contract_type,
              weekly_hours::float8 as weekly_hours,
              coalesce(timeclock_enabled, true) as timeclock_enabled,
              status, user_id
         from public.teachers
        where id=$1 and school_id=$2 limit 1`,
      [req.params.id, req.ctx!.schoolId],
    );
    if (rows.length === 0) return null;
    await audit(c, {
      schoolId: req.ctx!.schoolId!, userId: req.ctx!.profileId,
      action: 'STAFF_EDIT_OPENED', entityType: 'staff', entityId: req.params.id,
      metadata: { name: rows[0].name },
    });
    return rows[0];
  });
  if (!data) return res.status(404).json({ code: 'not_found' });
  res.json({ ok: true, data });
});

staffRouter.post('/', requireRole('school_admin', 'superadmin'), validateBody(staffCreateSchema), async (req, res) => {
  const s = req.body as import('../../../../shared/schemas').StaffCreateOutput;

  try {
    const result = await withTenant(req.ctx!, async (c) => {
      // matrícula F global
      const matRow = await c.query(`select public.next_staff_matricula() as matricula`);
      const matricula: string = matRow.rows[0].matricula;

      // Senha inicial = padrão único da plataforma (troca obrigatória no 1º acesso).
      // Login primário = e-mail; matrícula também funciona via publicAuth.
      const visiblePassword = DEFAULT_GUARDIAN_PASSWORD;
      const authResult = await signUpGuardian({
        email: s.email,
        password: toStoredPassword(visiblePassword),
        name: s.name,
      });

      // criar profile (role = role_type) com flag de troca de senha obrigatória
      const profileRow = await c.query(
        `insert into public.profiles (auth_user_id, school_id, name, email, phone, role, cpf, password_change_required)
         values ($1, $2, $3, $4, $5, $6, $7, true)
         returning id`,
        [authResult.authUserId, req.ctx!.schoolId, s.name, s.email, s.phone ?? null,
         s.role_type, s.cpf],
      );
      const profileId = profileRow.rows[0].id;

      // criar teachers (staff)
      const tRow = await c.query(
        `insert into public.teachers
           (school_id, user_id, name, email, phone, cpf, registration_number, role_type, subject_teaches,
            position, admission_date, contract_type, weekly_hours, timeclock_enabled)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         returning id, user_id, name, email, phone, cpf, registration_number, role_type, subject_teaches,
                   position, admission_date::text as admission_date, contract_type, weekly_hours::float8 as weekly_hours,
                   timeclock_enabled, status, created_at`,
        [req.ctx!.schoolId, profileId, s.name, s.email, s.phone ?? null, s.cpf,
         matricula, s.role_type, s.subject_teaches ?? null,
         s.position ?? null, s.admission_date ?? null, s.contract_type ?? null, s.weekly_hours ?? null,
         s.timeclock_enabled ?? true],
      );

      return {
        ...tRow.rows[0],
        login_matricula: matricula,
        initial_password: visiblePassword,
        login_password_hint: 'Login: e-mail do funcionário • Senha inicial padrão: Escola@2026 — troca obrigatória no 1º acesso.',
      };
    });
    res.status(201).json({ ok: true, data: result });
  } catch (err: any) {
    console.error('[staff.create] erro:', err?.message ?? err);
    res.status(err?.http ?? 500).json({
      code: err?.code ?? 'create_failed',
      message: err?.message ?? 'Falha ao criar funcionário',
    });
  }
});

// ---------- Resetar senha para a padrão da plataforma (gestão) ----------
// Volta a senha do funcionário para Escola@2026 gravando o hash direto na
// tabela de contas do Neon Auth (schema neon_auth). Só sobrescreve se o hash
// atual estiver no formato scrypt do Better Auth — caso contrário aborta e
// orienta a usar o fluxo "Esqueci minha senha".
staffRouter.post('/:id/reset-password', requireRole('school_admin', 'superadmin'), async (req, res) => {
  try {
    const result = await withTenant(req.ctx!, async (c) => {
      const t = await c.query(
        `select user_id, name, email from public.teachers where id=$1 and school_id=$2 limit 1`,
        [req.params.id, req.ctx!.schoolId],
      );
      if (t.rows.length === 0) return { error: 'not_found' as const };
      const { user_id: profileId, name, email } = t.rows[0];
      if (!profileId) return { error: 'no_auth' as const };

      const p = await c.query(
        `select auth_user_id from public.profiles where id=$1 and school_id=$2 limit 1`,
        [profileId, req.ctx!.schoolId],
      );
      if (p.rows.length === 0 || !p.rows[0].auth_user_id) return { error: 'no_auth' as const };
      const authUserId = p.rows[0].auth_user_id;

      // Localiza a tabela de contas do Better Auth (o nome/casing varia entre versões)
      const tbl = await c.query(
        `select table_name from information_schema.tables
          where table_schema='neon_auth' and lower(table_name) in ('account','accounts') limit 1`,
      );
      if (tbl.rows.length === 0) return { error: 'schema_mismatch' as const };
      const tableName: string = tbl.rows[0].table_name;

      const cols = await c.query(
        `select column_name from information_schema.columns
          where table_schema='neon_auth' and table_name=$1`,
        [tableName],
      );
      const names: string[] = cols.rows.map((r: any) => r.column_name);
      const userCol = names.includes('userId') ? '"userId"' : names.includes('user_id') ? 'user_id' : null;
      const provCol = names.includes('providerId') ? '"providerId"' : names.includes('provider_id') ? 'provider_id' : null;
      if (!userCol || !provCol || !names.includes('password')) return { error: 'schema_mismatch' as const };

      const acc = await c.query(
        `select id, password from neon_auth."${tableName}"
          where ${userCol}=$1 and ${provCol}='credential' limit 1`,
        [authUserId],
      );
      if (acc.rows.length === 0) return { error: 'no_credential' as const };

      // Só sobrescreve hash em formato scrypt "saltHex:hashHex" (ou vazio)
      const current = String(acc.rows[0].password ?? '');
      if (current && !/^[a-f0-9]{16,64}:[a-f0-9]{64,256}$/i.test(current)) {
        return { error: 'hash_format' as const };
      }

      await c.query(
        `update neon_auth."${tableName}" set password=$2 where id=$1`,
        [acc.rows[0].id, betterAuthHash(DEFAULT_GUARDIAN_PASSWORD)],
      );
      await c.query(
        `update public.profiles set password_change_required=true where id=$1`,
        [profileId],
      );
      return { name, email };
    });

    if ('error' in result && result.error) {
      const code: string = result.error;
      const map: Record<string, { http: number; message: string }> = {
        not_found: { http: 404, message: 'Funcionário não encontrado.' },
        no_auth: { http: 400, message: 'Este funcionário não possui login vinculado.' },
        no_credential: { http: 400, message: 'Conta de login sem senha cadastrada — peça ao funcionário para usar "Esqueci minha senha".' },
        schema_mismatch: { http: 501, message: 'Estrutura do provedor de login não reconhecida — use o fluxo "Esqueci minha senha".' },
        hash_format: { http: 409, message: 'Formato de senha do provedor não reconhecido — por segurança, use o fluxo "Esqueci minha senha".' },
      };
      const m = map[code] ?? { http: 400, message: 'Não foi possível resetar a senha.' };
      return res.status(m.http).json({ code, message: m.message });
    }

    res.json({ ok: true, data: { ...result, initial_password: DEFAULT_GUARDIAN_PASSWORD } });
  } catch (err: any) {
    console.error('[staff.reset-password] erro:', err?.message ?? err);
    res.status(500).json({ code: 'reset_failed', message: 'Falha ao resetar a senha.' });
  }
});

staffRouter.put('/:id', requireRole('school_admin', 'superadmin'), validateBody(staffUpdateSchema), async (req, res) => {
  const s = req.body as import('../../../../shared/schemas').StaffUpdateOutput;
  const updated = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `update public.teachers set
          name=coalesce($1,name),
          email=coalesce($2,email),
          phone=coalesce($3,phone),
          cpf=coalesce($4,cpf),
          role_type=coalesce($5,role_type),
          subject_teaches=coalesce($6,subject_teaches),
          position=coalesce($9,position),
          admission_date=coalesce($10,admission_date),
          contract_type=coalesce($11,contract_type),
          weekly_hours=coalesce($12,weekly_hours),
          timeclock_enabled=coalesce($13,timeclock_enabled)
        where id=$7 and school_id=$8
        returning id, name, email, phone, cpf, role_type, subject_teaches,
                  position, admission_date::text as admission_date, contract_type, weekly_hours::float8 as weekly_hours,
                  timeclock_enabled, status, registration_number, user_id`,
      [s.name ?? null, s.email ?? null, s.phone ?? null, s.cpf ?? null,
       s.role_type ?? null, s.subject_teaches ?? null, req.params.id, req.ctx!.schoolId,
       s.position ?? null, s.admission_date ?? null, s.contract_type ?? null, s.weekly_hours ?? null,
       s.timeclock_enabled ?? null],
    );
    if (rows[0]?.user_id) {
      await c.query(
        `update public.profiles set
            name=coalesce($1,name), email=coalesce($2,email),
            phone=coalesce($3,phone), cpf=coalesce($4,cpf),
            role=coalesce($5,role)
          where id=$6`,
        [s.name ?? null, s.email ?? null, s.phone ?? null, s.cpf ?? null,
         s.role_type ?? null, rows[0].user_id],
      );
    }
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found' });
  res.json({ ok: true, data: updated });
});

staffRouter.delete('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `update public.teachers set status = 'inactive' where id = $1 and school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.status(204).end();
});
