import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../lib/validateBody';
import { schoolSettingsSchema } from '../../../../shared/schemas';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

// Express 4 não encaminha rejeições de handlers async para o error handler
// global automaticamente — sem o try/catch, uma falha no SQL (ex.: coluna
// ausente por migration não aplicada) deixa a requisição pendurada para
// sempre, sem resposta. O cliente fica "Carregando…" indefinidamente.
settingsRouter.get('/', async (req, res) => {
  try {
    const data = await withTenant(req.ctx!, async (c) => {
      const { rows } = await c.query(
        `select id, name, legal_name, cnpj, email, phone, logo_url, status,
                subscription_status, trial_ends_at,
                coalesce(late_fine_pct, 0)::float8     as late_fine_pct,
                coalesce(late_interest_pct, 0)::float8 as late_interest_pct
           from public.schools where id = $1`,
        [req.ctx!.schoolId],
      );
      return rows[0] ?? null;
    });
    res.json({ ok: true, data });
  } catch (err: any) {
    console.error('[settings.get] erro:', err?.message ?? err);
    res.status(500).json({ code: 'settings_load_failed', message: 'Não foi possível carregar as configurações.' });
  }
});

settingsRouter.put('/', requireRole('school_admin', 'superadmin'), validateBody(schoolSettingsSchema), async (req, res) => {
  const p = req.body as import('../../../../shared/schemas').SchoolSettingsOutput;

  const ALLOWED_COLS = ['name', 'legal_name', 'cnpj', 'email', 'phone', 'logo_url', 'late_fine_pct', 'late_interest_pct'];
  const fields = Object.entries(p).filter(([k, v]) => v !== undefined && ALLOWED_COLS.includes(k));
  if (fields.length === 0) return res.json({ ok: true });

  const sets = fields.map(([k], i) => `"${k}" = $${i + 2}`).join(', ');
  const vals = fields.map(([, v]) => v);

  try {
    await withTenant(req.ctx!, async (c) => {
      await c.query(
        `update public.schools set ${sets} where id = $1`,
        [req.ctx!.schoolId, ...vals],
      );
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[settings.put] erro:', err?.message ?? err);
    res.status(500).json({ code: 'settings_save_failed', message: 'Não foi possível salvar as configurações.' });
  }
});
