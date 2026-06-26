import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

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

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  legal_name: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  logo_url: z.string().optional(),
});

settingsRouter.put('/', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const p = updateSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });

  const ALLOWED_COLS = ['name', 'legal_name', 'cnpj', 'email', 'phone', 'logo_url'];
  const fields = Object.entries(p.data).filter(([k, v]) => v !== undefined && ALLOWED_COLS.includes(k));
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
