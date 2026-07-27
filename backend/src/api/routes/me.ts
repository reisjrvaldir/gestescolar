import { Router } from 'express';
import { createHash } from 'crypto';
import { z } from 'zod';
import { withSystem } from '../../db/withTenant';
import { requireIdentity, resolveProfile } from '../../middleware/auth';

export const meRouter = Router();

/** Versão atual dos documentos legais.
 *  Sincronizar com frontend/src/lib/consentVersions.ts ao publicar nova versão. */
const CURRENT_TERMS_VERSION = '2026-01-01';
const CURRENT_PRIVACY_VERSION = '2026-01-01';

function hashValue(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

// GET /api/me — quem sou eu? Retorna perfil + escola, ou hasProfile:false.
meRouter.get('/', requireIdentity, async (req, res) => {
  const id = req.identity!;
  const ctx = await resolveProfile(id.authUserId);
  if (!ctx) {
    return res.json({ ok: true, authenticated: true, hasProfile: false, email: id.email });
  }
  const rows = await withSystem(async (c) => {
    const r = await c.query(
      `select p.id as profile_id, p.name, p.email, p.role, p.password_change_required,
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
  terms_version: z.string().optional(),
  privacy_version: z.string().optional(),
});

// POST /api/me/onboarding — cria escola + perfil (school_admin) no 1º acesso.
meRouter.post('/onboarding', requireIdentity, async (req, res) => {
  const id = req.identity!;

  // Já tem perfil? Retorna idempotente.
  const existing = await resolveProfile(id.authUserId);
  if (existing) return res.status(200).json({ ok: true, alreadyOnboarded: true });

  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  }
  const { school_name, admin_name, cnpj, phone, terms_version, privacy_version } = parsed.data;

  const tv = terms_version ?? CURRENT_TERMS_VERSION;
  const pv = privacy_version ?? CURRENT_PRIVACY_VERSION;
  const ipHash = hashValue(req.ip ?? '');
  const uaHash = hashValue(req.headers['user-agent'] ?? '');

  const { schoolId } = await withSystem(async (client) => {
    // Trial de 7 dias a partir de agora.
    const school = await client.query(
      `insert into public.schools (name, cnpj, phone, status, subscription_status, trial_ends_at)
       values ($1, $2, $3, 'active', 'trialing', now() + interval '7 days')
       returning id`,
      [school_name, cnpj ?? null, phone ?? null],
    );
    const newSchoolId = school.rows[0].id;

    const profileRes = await client.query(
      `insert into public.profiles (auth_user_id, school_id, name, email, role, status)
       values ($1, $2, $3, $4, 'school_admin', 'active') returning id`,
      [id.authUserId, newSchoolId, admin_name, id.email ?? null],
    );
    const newProfileId = profileRes.rows[0].id;

    await client.query(
      `insert into public.school_balances (school_id) values ($1)`,
      [newSchoolId],
    );

    // Registra o aceite dos termos com evidência técnica mínima (hashes).
    await client.query(
      `insert into public.consent_log
         (profile_id, school_id, terms_version, privacy_version, ip_hash, user_agent_hash, purpose)
       values ($1, $2, $3, $4, $5, $6, 'signup')`,
      [newProfileId, newSchoolId, tv, pv, ipHash, uaHash],
    );

    return { schoolId: newSchoolId };
  });

  res.status(201).json({ ok: true, school_id: schoolId });
});

// GET /api/me/consents — histórico de aceites de termos do usuário atual.
meRouter.get('/consents', requireIdentity, async (req, res) => {
  const id = req.identity!;
  const ctx = await resolveProfile(id.authUserId);
  if (!ctx) return res.json({ ok: true, data: [] });

  const rows = await withSystem(async (c) => {
    const r = await c.query(
      `select id, terms_version, privacy_version, accepted_at, purpose
         from public.consent_log
        where profile_id = $1
        order by accepted_at desc`,
      [ctx.profileId],
    );
    return r.rows;
  });
  res.json({ ok: true, data: rows });
});

// GET /api/me/consent-status — informa se o usuário precisa re-aceitar os termos.
meRouter.get('/consent-status', requireIdentity, async (req, res) => {
  const id = req.identity!;
  const ctx = await resolveProfile(id.authUserId);

  // Sem perfil (pré-onboarding) → não há re-aceite pendente.
  if (!ctx) {
    return res.json({ ok: true, data: { needs_reconsent: false } });
  }

  const rows = await withSystem(async (c) => {
    const r = await c.query(
      `select terms_version, privacy_version
         from public.consent_log
        where profile_id = $1
        order by accepted_at desc limit 1`,
      [ctx.profileId],
    );
    return r.rows;
  });

  const latest = rows[0] ?? null;
  // Se nunca houve registro (usuário pré-existente), não bloqueia.
  const needs_reconsent = latest
    ? (latest.terms_version !== CURRENT_TERMS_VERSION || latest.privacy_version !== CURRENT_PRIVACY_VERSION)
    : false;

  res.json({
    ok: true,
    data: {
      needs_reconsent,
      current_terms_version: CURRENT_TERMS_VERSION,
      current_privacy_version: CURRENT_PRIVACY_VERSION,
      accepted_terms_version: latest?.terms_version ?? null,
      accepted_privacy_version: latest?.privacy_version ?? null,
    },
  });
});

// POST /api/me/consent — registra re-aceite após alteração material dos documentos.
meRouter.post('/consent', requireIdentity, async (req, res) => {
  const id = req.identity!;
  const ctx = await resolveProfile(id.authUserId);
  if (!ctx) return res.status(400).json({ code: 'no_profile' });

  const ipHash = hashValue(req.ip ?? '');
  const uaHash = hashValue(req.headers['user-agent'] ?? '');

  await withSystem((c) =>
    c.query(
      `insert into public.consent_log
         (profile_id, school_id, terms_version, privacy_version, ip_hash, user_agent_hash, purpose)
       values ($1, $2, $3, $4, $5, $6, 'reconsent')`,
      [ctx.profileId, ctx.schoolId, CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, ipHash, uaHash],
    ),
  );
  res.json({ ok: true });
});
