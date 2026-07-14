import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { withTenant } from '../../db/withTenant';
import { buildChargeForInvoice, type BillingType } from '../../lib/payments';
import { notifyChargeCreated } from '../../lib/email';

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

// GET /api/invoices — faturas da escola (gestão/financeiro)
invoicesRouter.get('/', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select i.id, i.student_name, i.amount::float8 as amount, i.due_date, i.status, i.payment_method,
              i.kind, i.reference_month, i.checkout_url, i.paid_at, i.created_at,
              g.name as guardian_name, cl.name as class_name
         from public.invoices i
         left join public.students st on st.id = i.student_id
         left join public.guardians g on g.id = st.guardian_id
         left join public.classes cl on cl.id = st.class_id
        where i.school_id = $1
        order by i.due_date desc nulls last`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /api/invoices/mine — faturas do(s) aluno(s) do responsável autenticado.
invoicesRouter.get('/mine', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const guardian = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [req.ctx!.profileId]);
    if (guardian.rows.length === 0) return [];
    const { rows } = await c.query(
      `select i.id, i.student_name, i.amount::float8 as amount, i.due_date, i.status, i.kind,
              i.reference_month, i.pix_qr_code, i.pix_copy_paste, i.checkout_url, i.paid_at,
              b.title as charge_title, b.description as charge_description
         from public.invoices i
         join public.students s on s.id = i.student_id
         left join public.charge_batches b on b.id = i.batch_id
        where s.guardian_id = $1 and i.school_id = $2
        order by i.due_date asc nulls last`,
      [guardian.rows[0].id, req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// POST /api/invoices/:id/pix — gera/renova a cobrança PIX da fatura
invoicesRouter.post('/:id/pix', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const result = await withTenant(req.ctx!, async (c) => {
    const r = await buildChargeForInvoice(c, req.ctx!.schoolId!, req.params.id, 'PIX');
    if ('error' in r) return r;
    // Dados para notificar o responsável por e-mail (fora da transação).
    const info = await c.query(
      `select i.student_name, i.amount::float8 as amount, i.due_date, i.kind,
              g.email as guardian_email, b.title as charge_title, sc.name as school_name
         from public.invoices i
         left join public.students st on st.id = i.student_id
         left join public.guardians g on g.id = st.guardian_id
         left join public.charge_batches b on b.id = i.batch_id
         left join public.schools sc on sc.id = i.school_id
        where i.id=$1 and i.school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
    return { charge: r.charge, info: info.rows[0] as any };
  });
  if ('error' in result) {
    if (result.error === 'payout_not_ready') {
      return res.status(409).json({ code: 'payout_not_ready', message: 'Envie os documentos da conta de recebimento antes de gerar cobranças PIX.' });
    }
    return res.status(result.error === 'not_found' ? 404 : 409).json({ code: result.error, message: result.error });
  }

  // Notificação por e-mail — fire-and-forget: nunca bloqueia nem quebra a resposta.
  const info = result.info;
  if (info?.guardian_email) {
    notifyChargeCreated(info.guardian_email, {
      studentName: info.student_name,
      amount: Number(info.amount),
      dueDate: info.due_date instanceof Date ? info.due_date.toISOString().slice(0, 10) : info.due_date,
      description: info.kind === 'avulsa' ? (info.charge_title ?? 'Cobrança avulsa') : 'Mensalidade',
      schoolName: info.school_name,
    }).catch((e) => console.error('[invoices.pix] notificação de e-mail falhou:', e?.message ?? e));
  }

  res.json({ ok: true, data: result.charge });
});

// POST /api/invoices/:id/charge — cobrança PIX ou cartão de crédito
invoicesRouter.post('/:id/charge', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const billingType: BillingType = req.body?.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';
  const result = await withTenant(req.ctx!, (c) => buildChargeForInvoice(c, req.ctx!.schoolId!, req.params.id, billingType));
  if ('error' in result) {
    if (result.error === 'payout_not_ready') {
      return res.status(409).json({ code: 'payout_not_ready', message: 'Envie os documentos da conta de recebimento antes de gerar cobranças.' });
    }
    return res.status(result.error === 'not_found' ? 404 : 409).json({ code: result.error, message: result.error });
  }
  res.json({ ok: true, data: result.charge });
});

// GET /api/finance/balance — saldo da escola
invoicesRouter.get('/balance/summary', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
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
