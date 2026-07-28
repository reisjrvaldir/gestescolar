import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { signUpGuardian } from '../../lib/authSignup';
import { generateSecurePassword, toStoredPassword } from '../../lib/validation';
import { validateBody } from '../../lib/validateBody';
import { issueAndSendInvitation } from '../../lib/inviteFlow';
import { LATEST_INVITE_SQL, deriveInviteState } from '../../lib/invitations';
import { staffCreateSchema, staffUpdateSchema } from '../../../../shared/schemas';

export const staffRouter = Router();

staffRouter.use(requireAuth);

staffRouter.get('/', requireRole('school_admin', 'financial', 'teacher', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    // Dados pessoais sempre mascarados nas listagens — revelação via /personal-data/reveal
    const { rows } = await c.query(
      `select t.id, t.name,
              left(t.email,1) || '***@' || split_part(t.email,'@',2)                        as email,
              case when t.phone is null then null else '(**) ****-' || right(t.phone,4) end  as phone,
              '***.***.***-' || right(t.cpf,2)                                               as cpf,
              t.registration_number, t.role_type, t.subject_teaches,
              t.position, t.admission_date::text as admission_date, t.contract_type,
              t.weekly_hours::float8 as weekly_hours,
              coalesce(t.timeclock_enabled, true) as timeclock_enabled,
              t.status, t.created_at, t.user_id,
              ${LATEST_INVITE_SQL}
         from public.teachers t
         left join public.profiles p on p.id = t.user_id
        where t.school_id = $1
        order by t.name asc`,
      [req.ctx!.schoolId],
    );
    return rows.map((r: any) => ({
      ...r,
      access_activated_at: undefined,
      latest_invite_status: undefined,
      latest_invite_expires_at: undefined,
      invite_state: deriveInviteState(r),
    }));
  });
  res.json({ ok: true, data });
});

staffRouter.post('/', requireRole('school_admin', 'superadmin'), validateBody(staffCreateSchema), async (req, res) => {
  const s = req.body as import('../../../../shared/schemas').StaffCreateOutput;

  try {
    const result = await withTenant(req.ctx!, async (c) => {
      // matrícula F global
      const matRow = await c.query(`select public.next_staff_matricula() as matricula`);
      const matricula: string = matRow.rows[0].matricula;

      // Senha inicial ALEATÓRIA e DESCARTADA: ninguém — nem o gestor — a conhece.
      // O acesso só é ativado via convite individual (o usuário define a própria
      // senha). Login primário = e-mail; matrícula também funciona via publicAuth.
      const throwawayPassword = generateSecurePassword();
      const authResult = await signUpGuardian({
        email: s.email,
        password: toStoredPassword(throwawayPassword),
        name: s.name,
      });

      // criar profile (role = role_type) — acesso pendente até aceitar o convite
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

      // Emite o convite individual e dispara o e-mail com o link de uso único.
      const invite = await issueAndSendInvitation(c, {
        schoolId: req.ctx!.schoolId!,
        profileId,
        authUserId: authResult.authUserId,
        email: s.email,
        name: s.name,
        purpose: 'invite',
        createdByProfileId: req.ctx!.profileId,
        createdByEmail: req.identity?.email ?? null,
      });

      return {
        ...tRow.rows[0],
        login_matricula: matricula,
        invite_state: 'pending',
        invite_emailed: invite.emailed,
        login_hint: 'O funcionário recebe um convite por e-mail para criar a própria senha. Login: e-mail ou matrícula.',
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

// ---------- Enviar / reenviar convite de acesso (gestão) ----------
// Gera um novo convite individual de uso único e reenvia o link por e-mail.
// NÃO define nem revela senha. purpose='recovery' quando o acesso já foi
// ativado (equivale a "reenviar link de recuperação"); 'invite' caso contrário.
async function sendStaffInvite(req: any, res: any) {
  try {
    const result = await withTenant(req.ctx!, async (c: any) => {
      const t = await c.query(
        `select t.user_id, t.name, t.email, p.auth_user_id, p.access_activated_at
           from public.teachers t
           left join public.profiles p on p.id = t.user_id
          where t.id=$1 and t.school_id=$2 limit 1`,
        [req.params.id, req.ctx!.schoolId],
      );
      if (t.rows.length === 0) return { error: 'not_found' as const };
      const row = t.rows[0];
      if (!row.user_id || !row.auth_user_id) return { error: 'no_auth' as const };

      const purpose: 'invite' | 'recovery' = row.access_activated_at ? 'recovery' : 'invite';
      const invite = await issueAndSendInvitation(c, {
        schoolId: req.ctx!.schoolId!,
        profileId: row.user_id,
        authUserId: row.auth_user_id,
        email: row.email,
        name: row.name,
        purpose,
        createdByProfileId: req.ctx!.profileId,
        createdByEmail: req.identity?.email ?? null,
      });
      return { emailed: invite.emailed, wasResend: invite.wasResend, purpose };
    });

    if ('error' in result && result.error) {
      const map: Record<string, { http: number; message: string }> = {
        not_found: { http: 404, message: 'Funcionário não encontrado.' },
        no_auth: { http: 400, message: 'Este funcionário não possui login vinculado.' },
      };
      const m = map[result.error] ?? { http: 400, message: 'Não foi possível enviar o convite.' };
      return res.status(m.http).json({ code: result.error, message: m.message });
    }
    res.json({ ok: true, data: result });
  } catch (err: any) {
    console.error('[staff.invite] erro:', err?.message ?? err);
    res.status(500).json({ code: 'invite_failed', message: 'Falha ao enviar o convite.' });
  }
}

staffRouter.post('/:id/invite',  requireRole('school_admin', 'superadmin'), sendStaffInvite);
staffRouter.post('/:id/recover', requireRole('school_admin', 'superadmin'), sendStaffInvite);

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
