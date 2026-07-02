// =============================================================
//  Provedor de SIMULAÇÃO — usado quando nenhum gateway está configurado.
//  Permite testar o fluxo (cobrança → webhook → split → saldo) de ponta a
//  ponta sem chamadas externas. NUNCA usar em produção com pagamento real.
// =============================================================
import type { PaymentProvider, CreateChargeInput, ChargeResult, NormalizedWebhookEvent } from './types';

export const simulationProvider: PaymentProvider = {
  name: 'simulation',

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const fakeId = `sim_${input.invoiceId.slice(0, 8)}_${Date.now()}`;
    const base: ChargeResult = {
      providerChargeId: fakeId,
      billingType: input.billingType,
      status: 'PENDING',
      amount: input.amount,
    };
    if (input.billingType === 'PIX') {
      base.pixQrCode = `SIMULADO:${fakeId}`;
      base.pixCopyPaste = `00020126SIMULADO-PIX-${fakeId}5204000053039865802BR`;
    } else {
      base.invoiceUrl = `https://sandbox.local/checkout/${fakeId}`;
    }
    return base;
  },

  verifyWebhook(): boolean {
    // Sem gateway real: aceita (ambiente de teste).
    return true;
  },

  parseWebhook(body): NormalizedWebhookEvent | null {
    const b = (body ?? {}) as any;
    const p = b.payment ?? b.data ?? {};
    const rawType: string = b.event ?? b.type ?? 'UNKNOWN';
    if (!p.id) return null;
    const type = (rawType === 'PAYMENT_CONFIRMED' || rawType === 'PAYMENT_RECEIVED')
      ? (rawType as NormalizedWebhookEvent['type']) : 'OTHER';
    return {
      type,
      rawType,
      providerPaymentId: String(p.id),
      providerChargeId: p.chargeId ? String(p.chargeId) : undefined,
      amount: p.amount != null ? Number(p.amount) : undefined,
      billingType: p.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX',
      externalReference: p.invoiceId ? String(p.invoiceId) : (p.externalReference ? String(p.externalReference) : undefined),
    };
  },

  async requestWithdrawal(): Promise<{ providerWithdrawalId: string }> {
    return { providerWithdrawalId: `sim_wd_${Date.now()}` };
  },
};
