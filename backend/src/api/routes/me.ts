import { Router } from 'express';
import { z } from 'zod';
import { withSystem } from '../../db/withTenant';
import { requireIdentity, resolveProfile } from '../../middleware/auth';

export const meRouter = Router();

// GET /api/me — quem sou eu? Retorna perfil + escola, ou hasProfile:false.
meRouter.get('/', requireIdentity, async (req, res) => {
  const id = req.identity!;
  const ctx = await resolveProfile(id.authUserId);
  if (!ctx) {
    return res.json({ ok: true, authenticated: true, hasProfile: false, email: id.email });
  }
  const rows = await withSystem(async (c) => {
    const r = await c.query(
      `select p.name, p.email, p.role, p.password_change_required,
              s.id as school_id, s.name as school_name,
              s.status as school_status, s.subscription_status, s.trial_ends_at
         from public.profiles p
         left join public.schools s on s.id = p.school_id
        where p.auth_user_id = $1 limit 1`,
      [id.authUserId],
    );
    return r.rows;
  });
  res.json({ ok: true, authenticated: true, hasProfile: true, profile: rows[0] });
});

// POST /api/me/password-changed — marca que o usuário já trocou a senha inicial.
// Frontend chama logo após sucesso do Better Auth changePassword.
meRouter.post('/password-changed', requireIdentity, async (req, res) => {
  const id = req.identity!;
  await withSystem((c) =>
    c.query(
      `update public.profiles set password_change_required = false where auth_user_id = $1`,
      [id.authUserId],
    ),
  );
  res.json({ ok: true });
});

const onboardingSchema = z.object({
  school_name: z.string().min(2, 'Informe o nome da escola'),
  admin_name: z.string().min(2, 'Informe seu nome'),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
});

// POST /api/onboarding — cria escola + perfil (school_admin) no 1º acesso.
meRouter.post('/onboarding', requireIdentity, async (req, res) => {
  const id = req.identity!;

  // Já tem perfil? Retorna idempotente.
  const existing = await resolveProfile(id.authUserId);
  if (existing) return res.status(200).json({ ok: true, alreadyOnboarded: true });

  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  }
  const { school_name, admin_name, cnpj, phone } = parsed.data;

  // Contexto de sistema: cria escola + 1º perfil (school_admin) + saldo.
  // Ainda não há escola no contexto do usuário — daí rodar como sistema.
  const schoolId = await withSystem(async (client) => {
    // Trial de 7 dias a partir de agora.
    const school = await client.query(
      `insert into public.schools (name, cnpj, phone, status, subscription_status, trial_ends_at)
       values ($1, $2, $3, 'active', 'trialing', now() + interval '7 days')
       returning id`,
      [school_name, cnpj ?? null, phone ?? null],
    );
    const newSchoolId = school.rows[0].id;
    await client.query(
      `insert into public.profiles (auth_user_id, school_id, name, email, role, status)
       values ($1, $2, $3, $4, 'school_admin', 'active')`,
      [id.authUserId, newSchoolId, admin_name, id.email ?? null],
    );
    await client.query(
      `insert into public.school_balances (school_id) values ($1)`,
      [newSchoolId],
    );
    return newSchoolId;
  });
  res.status(201).json({ ok: true, school_id: schoolId });
});
