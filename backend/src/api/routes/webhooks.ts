import { Router, type Request, type Response } from 'express';
import { pool } from '../../db/pool';
import { processConfirmedPayment, processSubscriptionPayment, buildChargeForInvoice } from '../../lib/payments';
import type { PaymentProvider, NormalizedWebhookEvent } from '../../lib/payments';
import { asaasProvider } from '../../lib/payments/asaas';
import { simulationProvider } from '../../lib/payments/simulation';
import { notify } from '../../lib/notifications';

export const webhooksRouter = Router();

/**
 * Cartão recusado numa cobrança de assinatura recorrente.
 *
 * Regra de produto: a fatura do mês volta para PIX e o responsável é avisado;
 * a recorrência permanece ativa para o mês seguinte. Assim ninguém fica sem
 * conseguir pagar por causa de um limite estourado num mês.
 *
 * Falhas aqui não podem derrubar o webhook: o ASAAS re-tentaria o evento e o
 * único efeito seria repetir o aviso. Por isso o try/catch abrangente.
 */
async function handleRecurringFailure(event: NormalizedWebhookEvent): Promise<void> {
  const subId = event.providerSubscriptionId;
  const invoiceId = event.externalReference;
  if (!subId && !invoiceId) return;

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1, $2, true)', ['app.user_role', 'superadmin']);

    const rec = await client.query(
      `select r.id, r.school_id, r.student_id, g.user_id as guardian_user_id, s.name as student_name
         from public.guardian_recurring_payments r
         join public.guardians g on g.id = r.guardian_id
         join public.students s on s.id = r.student_id
        where r.provider_subscription_id = $1 limit 1`,
      [subId ?? ''],
    );
    if (rec.rows.length === 0) {
      await client.query('rollback');
      return;
    }
    const r = rec.rows[0];

    await client.query(
      `update public.guardian_recurring_payments
          set status='failed', last_error=$2, updated_at=now()
        where id=$1`,
      [r.id, `Cartão recusado (${event.rawType})`],
    );

    // Fatura em aberto do aluno volta para PIX para destravar o pagamento.
    const inv = await client.query(
      `select id from public.invoices
        where student_id=$1 and school_id=$2 and status='pending'
        order by due_date asc nulls last limit 1`,
      [r.student_id, r.school_id],
    );
    if (inv.rows.length > 0) {
      await buildChargeForInvoice(client, String(r.school_id), String(inv.rows[0].id), 'PIX');
    }

    if (r.guardian_user_id) {
      await notify(client, {
        schoolId: String(r.school_id),
        profileId: String(r.guardian_user_id),
        type: 'payment_failed',
        title: 'Pagamento no cartão recusado',
        body: `Não conseguimos cobrar a mensalidade de ${r.student_name} no cartão cadastrado. `
          + 'A cobrança deste mês voltou para PIX — acesse Faturas para pagar. '
          + 'O pagamento automático segue ativo para o próximo mês.',
        link: '/app/faturas',
      });
    }

    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error('[webhook] falha ao tratar recusa de cartão recorrente', err);
  } finally {
    client.release();
  }
}

/**
 * Handler genérico de webhook de pagamento. Valida a autenticidade pelo
 * provedor, normaliza o evento e liquida o pagamento (fatura de aluno ou
 * assinatura SaaS, identificado pelo formato do externalReference).
 */
async function handlePaymentWebhook(provider: PaymentProvider, req: Request, res: Response) {
  const raw = JSON.stringify(req.body ?? {});
  const headers = req.headers as Record<string, string | undefined>;
  if (!provider.verifyWebhook(raw, headers)) {
    return res.status(401).json({ code: 'invalid_signature' });
  }

  const event = provider.parseWebhook(req.body);
  if (!event) return res.status(400).json({ code: 'invalid_payload' });

  // Cartão recusado numa cobrança recorrente: devolve a fatura do mês para
  // PIX. Sem isso o responsável ficaria com uma cobrança no cartão que não
  // passa e nenhuma forma alternativa de pagar. A recorrência continua ativa
  // — a falha de um mês não desliga o pagamento automático.
  if (event.type === 'PAYMENT_FAILED') {
    await handleRecurringFailure(event);
    return res.json({ ok: true, handled: 'card_refused' });
  }

  if (event.type !== 'PAYMENT_CONFIRMED' && event.type !== 'PAYMENT_RECEIVED') {
    return res.json({ ok: true, ignored: event.rawType });
  }

  const ref = event.externalReference;
  if (!ref || event.amount == null) {
    return res.status(400).json({ code: 'invalid_payload', message: 'externalReference e amount obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    // Liquidação é operação de sistema (identifica a escola pelo id da fatura /
    // pela referência da assinatura) → contexto superadmin para a RLS forçada.
    await client.query('select set_config($1, $2, true)', ['app.user_role', 'superadmin']);

    // Assinatura SaaS: externalReference = "subscription:{schoolId}:{planId}:{cycle}"
    if (ref.startsWith('subscription:')) {
      const [, schoolId, planId, cycle] = ref.split(':');
      const result = await processSubscriptionPayment(client, {
        schoolId,
        planId: planId || null,
        cycle: cycle === 'annual' ? 'annual' : 'monthly',
        grossAmount: Number(event.amount),
        providerPaymentId: event.providerPaymentId,
        providerChargeId: event.providerChargeId,
        provider: provider.name,
      });
      await client.query('commit');
      return res.json({ ok: true, applied: result.applied });
    }

    // Mensalidade cobrada pela assinatura recorrente do responsável:
    // externalReference = "recurring:{schoolId}:{studentId}".
    //
    // A assinatura é criada uma vez e o ASAAS gera uma cobrança por mês, todas
    // com essa mesma referência — ela aponta para o ALUNO, não para uma fatura.
    // Por isso localizamos aqui a fatura em aberto do mês; sem este ramo o
    // pagamento cairia no "ref_desconhecida" abaixo, o dinheiro entraria e a
    // fatura continuaria pendente.
    if (ref.startsWith('recurring:')) {
      const [, schoolId, studentId] = ref.split(':');
      const open = await client.query(
        `select id from public.invoices
          where student_id=$1 and school_id=$2 and status='pending'
          order by due_date asc nulls last limit 1`,
        [studentId, schoolId],
      );
      if (open.rows.length === 0) {
        await client.query('rollback');
        return res.json({ ok: true, ignored: 'sem_fatura_em_aberto' });
      }
      const result = await processConfirmedPayment(client, {
        schoolId,
        invoiceId: String(open.rows[0].id),
        grossAmount: Number(event.amount),
        providerPaymentId: event.providerPaymentId,
        providerChargeId: event.providerChargeId,
        provider: provider.name,
        paymentMethod: 'credit_card',
      });
      // 1ª cobrança confirmada = cartão cadastrado com sucesso → sai de
      // 'pending'. Também tira de 'failed' quando um mês volta a passar.
      await client.query(
        `update public.guardian_recurring_payments
            set status='active', last_error=null, last_charged_at=now(), updated_at=now()
          where student_id=$1 and school_id=$2`,
        [studentId, schoolId],
      );
      await client.query('commit');
      return res.json({ ok: true, applied: result.applied });
    }

    // Fatura de aluno: externalReference = invoiceId (UUID). Se não for um UUID
    // (cobrança não originada por nós), ignora com 200 para o ASAAS não re-tentar.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(ref)) {
      await client.query('rollback');
      return res.json({ ok: true, ignored: 'ref_desconhecida' });
    }
    const inv = await client.query('select school_id from public.invoices where id = $1 limit 1', [ref]);
    if (inv.rows.length === 0) {
      await client.query('rollback');
      return res.status(404).json({ code: 'invoice_not_found' });
    }
    const result = await processConfirmedPayment(client, {
      schoolId: String(inv.rows[0].school_id),
      invoiceId: ref,
      grossAmount: Number(event.amount),
      providerPaymentId: event.providerPaymentId,
      providerChargeId: event.providerChargeId,
      provider: provider.name,
      paymentMethod: event.billingType === 'CREDIT_CARD' ? 'credit_card' : 'pix',
    });
    await client.query('commit');
    res.json({ ok: true, applied: result.applied });
  } catch (err) {
    await client.query('rollback');
    console.error(`[webhook ${provider.name}] erro:`, err);
    res.status(500).json({ code: 'processing_error' });
  } finally {
    client.release();
  }
}

// ASAAS (produção): POST /api/webhooks/asaas
webhooksRouter.post('/asaas', (req, res) => handlePaymentWebhook(asaasProvider, req, res));

// Webhook de SIMULAÇÃO (verifyWebhook sempre true) — SÓ fora de produção.
// Em produção seria uma falha crítica: qualquer um poderia forjar a confirmação
// de um pagamento (marcar fatura paga / ativar assinatura SaaS de graça).
const IS_PROD = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
if (!IS_PROD) {
  webhooksRouter.post('/nuvende', (req, res) => handlePaymentWebhook(simulationProvider, req, res));
} else {
  webhooksRouter.post('/nuvende', (_req, res) => res.status(410).json({ code: 'disabled', message: 'Webhook de simulação desativado em produção.' }));
}
