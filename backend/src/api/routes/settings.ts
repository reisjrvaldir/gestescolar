import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../lib/validateBody';
import { schoolSettingsSchema } from '../../../../shared/schemas';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, name, legal_name, cnpj, email, phone, logo_url, status,
              subscription_status, trial_ends_at
         from public.schools where id = $1`,
      [req.ctx!.schoolId],
    );
    return rows[0] ?? null;
  });
  res.json({ ok: true, data });
});

settingsRouter.put('/', requireRole('school_admin', 'superadmin'), validateBody(schoolSettingsSchema), async (req, res) => {
  const p = req.body as import('../../../../shared/schemas').SchoolSettingsOutput;

  const ALLOWED_COLS = ['name', 'legal_name', 'cnpj', 'email', 'phone', 'logo_url'];
  const fields = Object.entries(p).filter(([k, v]) => v !== undefined && ALLOWED_COLS.includes(k));
  if (fields.length === 0) return res.json({ ok: true });

  const sets = fields.map(([k], i) => `"${k}" = $${i + 2}`).join(', ');
  const vals = fields.map(([, v]) => v);

  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `update public.schools set ${sets} where id = $1`,
      [req.ctx!.schoolId, ...vals],
    );
  });
  res.json({ ok: true });
});
