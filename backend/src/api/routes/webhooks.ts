import { Router, type Request, type Response } from 'express';
import { pool } from '../../db/pool';
import { processConfirmedPayment } from '../../lib/payments';
import type { PaymentProvider } from '../../lib/payments';
import { asaasProvider } from '../../lib/payments/asaas';
import { simulationProvider } from '../../lib/payments/simulation';

export const webhooksRouter = Router();

/**
 * Handler genérico de webhook de pagamento. Valida a autenticidade pelo
 * provedor, normaliza o evento e liquida o pagamento (split/saldo/baixa).
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

  // externalReference = invoiceId (enviado na criação da cobrança).
  const invoiceId = event.externalReference;
  if (!invoiceId || event.amount == null) {
    return res.status(400).json({ code: 'invalid_payload', message: 'externalReference (invoiceId) e amount obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    // Descobre a escola pela fatura (evita confiar em schoolId do payload).
    const inv = await client.query('select school_id from public.invoices where id = $1 limit 1', [invoiceId]);
    if (inv.rows.length === 0) {
      await client.query('rollback');
      return res.status(404).json({ code: 'invoice_not_found' });
    }
    const result = await processConfirmedPayment(client, {
      schoolId: String(inv.rows[0].school_id),
      invoiceId,
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

// Legado/simulação: POST /api/webhooks/nuvende (mantido para compatibilidade de testes)
webhooksRouter.post('/nuvende', (req, res) => handlePaymentWebhook(simulationProvider, req, res));
