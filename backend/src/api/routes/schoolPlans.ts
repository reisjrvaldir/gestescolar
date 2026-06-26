import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const schoolPlansRouter = Router();
schoolPlansRouter.use(requireAuth);

schoolPlansRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, name, monthly_fee::float8 as monthly_fee, status, created_at
         from public.school_plans
        where school_id = $1 and status = 'active'
        order by name`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

const planSchema = z.object({
  name: z.string().min(2),
  monthly_fee: z.number().nonnegative(),
});

schoolPlansRouter.post('/', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const p = planSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.school_plans (school_id, name, monthly_fee)
       values ($1, $2, $3) returning id, name, monthly_fee::float8 as monthly_fee, status, created_at`,
      [req.ctx!.schoolId, p.data.name, p.data.monthly_fee],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

schoolPlansRouter.put('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const p = planSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const updated = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `update public.school_plans set name=$1, monthly_fee=$2
        where id=$3 and school_id=$4
        returning id, name, monthly_fee::float8 as monthly_fee, status, created_at`,
      [p.data.name, p.data.monthly_fee, req.params.id, req.ctx!.schoolId],
    );
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found' });
  res.json({ ok: true, data: updated });
});

schoolPlansRouter.delete('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `update public.school_plans set status='inactive' where id=$1 and school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.status(204).end();
});
