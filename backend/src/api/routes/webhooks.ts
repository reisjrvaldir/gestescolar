import { Router } from 'express';
import { pool } from '../../db/pool';
import { verifyWebhookSignature, processConfirmedPayment } from '../../lib/nuvende';

export const webhooksRouter = Router();

// POST /api/webhooks/nuvende — recebe eventos do gateway (SEM auth de usuário;
// validado por assinatura). Confirma pagamento → split → saldo.
webhooksRouter.post('/nuvende', async (req, res) => {
  const raw = JSON.stringify(req.body ?? {});
  if (!verifyWebhookSignature(raw, req.header('x-nuvende-signature') ?? undefined)) {
    return res.status(401).json({ code: 'invalid_signature' });
  }

  const event = req.body ?? {};
  // Formato esperado (ajustar quando os docs do Nuvende chegarem):
  //   { event: 'PAYMENT_CONFIRMED', payment: { id, chargeId, invoiceId, schoolId, amount } }
  const type = event.event ?? event.type;
  const p = event.payment ?? event.data ?? {};

  if (type !== 'PAYMENT_CONFIRMED' && type !== 'PAYMENT_RECEIVED') {
    // Outros eventos: apenas 200 (idempotente / ignorado por ora)
    return res.json({ ok: true, ignored: type ?? 'unknown' });
  }

  if (!p.invoiceId || !p.schoolId || !p.amount || !p.id) {
    return res.status(400).json({ code: 'invalid_payload', message: 'invoiceId, schoolId, amount, id obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await processConfirmedPayment(client, {
      schoolId: String(p.schoolId),
      invoiceId: String(p.invoiceId),
      grossAmount: Number(p.amount),
      providerPaymentId: String(p.id),
      providerChargeId: p.chargeId ? String(p.chargeId) : undefined,
    });
    await client.query('commit');
    res.json({ ok: true, applied: result.applied });
  } catch (err) {
    await client.query('rollback');
    console.error('[webhook nuvende] erro:', err);
    res.status(500).json({ code: 'processing_error' });
  } finally {
    client.release();
  }
});
