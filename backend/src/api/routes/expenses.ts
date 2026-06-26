import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { dateSchema } from '../../lib/validation';

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

expensesRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, supplier_name, description, amount::float8 as amount, due_date, status, created_at
         from public.expenses
        where school_id = $1
        order by due_date desc nulls last`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

const expenseSchema = z.object({
  supplier_name: z.string().min(1, 'Informe o fornecedor'),
  description: z.string().optional(),
  amount: z.number().positive('Valor deve ser positivo'),
  due_date: dateSchema.optional(),
});

expensesRouter.post('/', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const p = expenseSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.expenses (school_id, supplier_name, description, amount, due_date, status)
       values ($1, $2, $3, $4, $5, 'pending') returning id, supplier_name, amount, status`,
      [req.ctx!.schoolId, p.data.supplier_name, p.data.description ?? null, p.data.amount, p.data.due_date ?? null],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

expensesRouter.patch('/:id/pay', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `update public.expenses set status = 'paid', updated_at = now() where id = $1 and school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.json({ ok: true });
});

expensesRouter.delete('/:id', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `delete from public.expenses where id = $1 and school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.status(204).end();
});
