import { Router, type Request, type Response } from 'express';
import { pool } from '../../db/pool';
import { processConfirmedPayment, processSubscriptionPayment } from '../../lib/payments';
import type { PaymentProvider } from '../../lib/payments';
import { asaasProvider } from '../../lib/payments/asaas';
import { simulationProvider } from '../../lib/payments/simulation';

export const webhooksRouter = Router();

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
