import { Router } from 'express';
import { createHash } from 'crypto';
import { withSystem } from '../../db/withTenant';
import { requireIdentity, resolveProfile } from '../../middleware/auth';
import { validateBody } from '../../lib/validateBody';
import { onboardingSchema } from '../../../../shared/schemas';

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
              s.status as school_status, s.subscription_status, s.trial_ends_at,
              s.logo_url, s.legal_name, s.cnpj,
              coalesce(s.enabled_modules, '{}'::jsonb) as enabled_modules
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

// POST /api/me/onboarding — FECHADO desde 07/08/2026.
//
// Antes, qualquer identidade autenticada criava uma escola e virava school_admin
// dela: bastava se cadastrar no Neon Auth. Por decisão de produto a operação
// passou a ser curada — só o superadmin abre escola, via POST /api/saas/schools,
// que já cria o perfil do gestor junto. Quem é cadastrado por lá loga com perfil
// pronto e nunca passa por aqui.
//
// A rota continua existindo (em vez de sumir) para responder de forma explícita
// a quem tenha o fluxo antigo em cache — 404 pareceria bug de deploy.
meRouter.post('/onboarding', requireIdentity, validateBody(onboardingSchema), async (req, res) => {
  const id = req.identity!;

  // Já tem perfil? Retorna idempotente — o app segue normal.
  const existing = await resolveProfile(id.authUserId);
  if (existing) return res.status(200).json({ ok: true, alreadyOnboarded: true });

  return res.status(403).json({
    code: 'onboarding_closed',
    message: 'A criação de escolas é feita pela equipe GestEscolar. Entre em contato para abrir a sua.',
  });
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
