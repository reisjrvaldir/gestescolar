import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { createPixCharge } from '../../lib/nuvende';
import { dateSchema } from '../../lib/validation';

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

// GET /api/invoices — faturas da escola
invoicesRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, student_name, amount::float8 as amount, due_date, status, payment_method, paid_at, created_at
         from public.invoices where school_id = $1 order by due_date desc nulls last`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

const invoiceSchema = z.object({
  student_id: z.string().uuid().optional(),
  student_name: z.string().min(1),
  amount: z.number().positive(),
  due_date: dateSchema.optional(),
});

// POST /api/invoices — gera fatura
invoicesRouter.post('/', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const p = invoiceSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.invoices (school_id, student_id, student_name, amount, due_date, status)
       values ($1,$2,$3,$4,$5,'pending') returning id, student_name, amount, status`,
      [req.ctx!.schoolId, p.data.student_id ?? null, p.data.student_name, p.data.amount, p.data.due_date ?? null],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

// POST /api/invoices/:id/pix — gera cobrança PIX (Nuvende)
invoicesRouter.post('/:id/pix', async (req, res) => {
  const result = await withTenant(req.ctx!, async (c) => {
    const inv = await c.query(
      `select id, amount, student_name, status from public.invoices where id=$1 and school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
    if (inv.rows.length === 0) return { error: 'not_found' as const };
    const invoice = inv.rows[0];
    if (invoice.status === 'paid') return { error: 'already_paid' as const };

    const charge = await createPixCharge({
      invoiceId: invoice.id,
      amount: Number(invoice.amount),
      description: `Mensalidade — ${invoice.student_name}`,
    });
    await c.query(
      `update public.invoices set nuvende_charge_id=$1, pix_qr_code=$2, pix_copy_paste=$3, payment_method='pix' where id=$4`,
      [charge.providerChargeId, charge.qrCode, charge.copyPaste, invoice.id],
    );
    return { charge };
  });

  if ('error' in result) {
    const code = result.error === 'not_found' ? 404 : 409;
    return res.status(code).json({ code: result.error, message: result.error });
  }
  res.json({ ok: true, data: result.charge });
});

// GET /api/finance/balance — saldo da escola
invoicesRouter.get('/balance/summary', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select available_balance::float8 as available_balance,
              pending_balance::float8 as pending_balance,
              gross_received_total::float8 as gross_received_total,
              platform_fees_total::float8 as platform_fees_total,
              provider_fees_total::float8 as provider_fees_total,
              withdrawn_total::float8 as withdrawn_total
         from public.school_balances where school_id = $1`,
      [req.ctx!.schoolId],
    );
    return rows[0] ?? {
      available_balance: 0, pending_balance: 0, gross_received_total: 0,
      platform_fees_total: 0, provider_fees_total: 0, withdrawn_total: 0,
    };
  });
  res.json({ ok: true, data });
});
