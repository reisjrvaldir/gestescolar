import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getPaymentProvider, isAsaasConfigured, type BillingType, type CreateChargeInput } from '../../lib/payments';
import { calculatePixSplit } from '../../lib/fees';
import { dateSchema } from '../../lib/validation';
import type { PoolClient } from '@neondatabase/serverless';

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

/**
 * Cria uma cobrança (PIX ou cartão) para a fatura, usando o provedor ativo.
 * Cliente e split só são resolvidos quando o ASAAS está configurado (evita
 * depender de colunas de subconta antes da migração 0009).
 */
async function createChargeForInvoice(
  c: PoolClient, schoolId: string, invoiceId: string, billingType: BillingType,
) {
  const inv = await c.query(
    `select id, amount::float8 as amount, student_name, status, student_id
       from public.invoices where id=$1 and school_id=$2`,
    [invoiceId, schoolId],
  );
  if (inv.rows.length === 0) return { error: 'not_found' as const };
  const invoice = inv.rows[0];
  if (invoice.status === 'paid') return { error: 'already_paid' as const };

  const chargeInput: CreateChargeInput = {
    invoiceId: invoice.id,
    amount: Number(invoice.amount),
    description: `Mensalidade — ${invoice.student_name}`,
    billingType,
  };

  if (isAsaasConfigured) {
    // Resolve pagador (responsável) + carteira de split (subconta da escola).
    const ctxRow = await c.query(
      `select g.name, g.cpf, g.email, g.phone, g.asaas_customer_id, s.asaas_wallet_id
         from public.invoices i
         left join public.students st on st.id = i.student_id
         left join public.guardians g on g.id = st.guardian_id
         left join public.schools s on s.id = i.school_id
        where i.id=$1 and i.school_id=$2`,
      [invoiceId, schoolId],
    );
    const r = ctxRow.rows[0] ?? {};
    chargeInput.customer = {
      name: r.name ?? invoice.student_name,
      cpfCnpj: r.cpf ?? undefined,
      email: r.email ?? undefined,
      phone: r.phone ?? undefined,
      providerCustomerId: r.asaas_customer_id ?? undefined,
    };
    if (r.asaas_wallet_id) {
      // Envia o líquido da escola para a subconta dela; plataforma retém a taxa.
      const split = calculatePixSplit(Number(invoice.amount));
      chargeInput.split = [{ walletId: r.asaas_wallet_id, fixedValue: split.schoolNetAmount }];
    }
  }

  const charge = await getPaymentProvider().createCharge(chargeInput);

  // Persiste em colunas já existentes (provider_charge_id em nuvende_charge_id).
  await c.query(
    `update public.invoices
        set nuvende_charge_id=$1, pix_qr_code=$2, pix_copy_paste=$3, payment_method=$4
      where id=$5`,
    [charge.providerChargeId, charge.pixQrCode ?? null, charge.pixCopyPaste ?? null,
     billingType === 'CREDIT_CARD' ? 'card' : 'pix', invoice.id],
  );

  // Se houver customerId novo do provedor, guarda no responsável (quando ASAAS).
  if (isAsaasConfigured && charge.providerCustomerId && invoice.student_id) {
    await c.query(
      `update public.guardians set asaas_customer_id=$1
         where id = (select guardian_id from public.students where id=$2) and asaas_customer_id is null`,
      [charge.providerCustomerId, invoice.student_id],
    );
  }

  return { charge };
}

// POST /api/invoices/:id/pix — gera cobrança PIX
invoicesRouter.post('/:id/pix', async (req, res) => {
  const result = await withTenant(req.ctx!, (c) => createChargeForInvoice(c, req.ctx!.schoolId!, req.params.id, 'PIX'));
  if ('error' in result) {
    return res.status(result.error === 'not_found' ? 404 : 409).json({ code: result.error, message: result.error });
  }
  res.json({ ok: true, data: result.charge });
});

// POST /api/invoices/:id/charge — cobrança PIX ou cartão de crédito
invoicesRouter.post('/:id/charge', async (req, res) => {
  const billingType: BillingType = req.body?.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';
  const result = await withTenant(req.ctx!, (c) => createChargeForInvoice(c, req.ctx!.schoolId!, req.params.id, billingType));
  if ('error' in result) {
    return res.status(result.error === 'not_found' ? 404 : 409).json({ code: result.error, message: result.error });
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
