// =============================================================
//  Provedor de pagamento ASAAS (PIX + Cartão de crédito + Split).
//
//  Env necessárias (backend/.env e Vercel):
//    ASAAS_API_KEY        — chave da conta ASAAS (obrigatória p/ ativar)
//    ASAAS_ENV            — 'sandbox' | 'production' (default: sandbox)
//    ASAAS_WEBHOOK_TOKEN  — token configurado no painel ASAAS p/ validar webhooks
//
//  Modelo de split: a plataforma (GestEscolar) é a conta principal ASAAS.
//  Cada escola tem uma subconta (walletId em schools.asaas_wallet_id). Na
//  cobrança, o líquido da escola é enviado à walletId dela; a plataforma
//  retém a taxa. Escola sem walletId → cobrança sem split (tudo na conta
//  principal), até concluir o onboarding da subconta.
// =============================================================
import type {
  PaymentProvider, CreateChargeInput, ChargeResult, NormalizedWebhookEvent, ChargeCustomer,
} from './types';

const API_KEY = process.env.ASAAS_API_KEY;
const ENV = (process.env.ASAAS_ENV ?? 'sandbox').toLowerCase();
const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

export const isAsaasConfigured = Boolean(API_KEY);

const BASE_URL = ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function asaasFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_KEY) throw new Error('ASAAS_API_KEY não configurado');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: API_KEY,
      'User-Agent': 'GestEscolar',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? `ASAAS HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { http: res.status, asaas: data });
  }
  return data as T;
}

/** Garante um cliente no ASAAS (reaproveita providerCustomerId quando houver). */
async function ensureCustomer(customer: ChargeCustomer): Promise<string> {
  if (customer.providerCustomerId) return customer.providerCustomerId;
  if (!customer.cpfCnpj) {
    throw Object.assign(new Error('CPF/CNPJ do pagador é obrigatório para criar cobrança no ASAAS'), { http: 400 });
  }
  const created = await asaasFetch<{ id: string }>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: customer.name,
      cpfCnpj: customer.cpfCnpj,
      email: customer.email,
      mobilePhone: customer.phone,
    }),
  });
  return created.id;
}

export const asaasProvider: PaymentProvider = {
  name: 'asaas',

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    if (!input.customer) {
      throw Object.assign(new Error('Dados do pagador são obrigatórios para o ASAAS'), { http: 400 });
    }
    const customerId = await ensureCustomer(input.customer);

    const body: Record<string, unknown> = {
      customer: customerId,
      billingType: input.billingType, // 'PIX' | 'CREDIT_CARD'
      value: input.amount,
      dueDate: input.dueDate ?? todayIso(),
      description: input.description,
      externalReference: input.invoiceId,
    };
    if (input.split && input.split.length > 0) {
      body.split = input.split.map((s) => ({
        walletId: s.walletId,
        ...(s.fixedValue != null ? { fixedValue: s.fixedValue } : {}),
        ...(s.percentualValue != null ? { percentualValue: s.percentualValue } : {}),
      }));
    }

    const charge = await asaasFetch<{ id: string; status: string; invoiceUrl?: string }>(
      '/payments', { method: 'POST', body: JSON.stringify(body) },
    );

    const result: ChargeResult = {
      providerChargeId: charge.id,
      billingType: input.billingType,
      status: charge.status,
      amount: input.amount,
      invoiceUrl: charge.invoiceUrl,
      providerCustomerId: customerId,
    };

    // PIX: buscar QR code + copia-e-cola.
    if (input.billingType === 'PIX') {
      const qr = await asaasFetch<{ encodedImage?: string; payload?: string }>(
        `/payments/${charge.id}/pixQrCode`,
      );
      result.pixQrCode = qr.encodedImage;
      result.pixCopyPaste = qr.payload;
    }
    return result;
  },

  verifyWebhook(_rawBody, headers): boolean {
    // ASAAS envia o token configurado no painel no header 'asaas-access-token'.
    if (!WEBHOOK_TOKEN) return false; // exige token em produção — sem ele, rejeita.
    const received = headers['asaas-access-token'] ?? headers['Asaas-Access-Token'];
    return received === WEBHOOK_TOKEN;
  },

  parseWebhook(body): NormalizedWebhookEvent | null {
    const b = (body ?? {}) as any;
    const payment = b.payment ?? {};
    const rawType: string = b.event ?? 'UNKNOWN';
    if (!payment.id) return null;

    let type: NormalizedWebhookEvent['type'] = 'OTHER';
    if (rawType === 'PAYMENT_CONFIRMED') type = 'PAYMENT_CONFIRMED';
    else if (rawType === 'PAYMENT_RECEIVED') type = 'PAYMENT_RECEIVED';

    return {
      type,
      rawType,
      providerPaymentId: String(payment.id),
      providerChargeId: payment.id ? String(payment.id) : undefined,
      amount: payment.value != null ? Number(payment.value) : undefined,
      billingType: payment.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX',
      externalReference: payment.externalReference ? String(payment.externalReference) : undefined,
    };
  },

  async requestWithdrawal(input): Promise<{ providerWithdrawalId: string }> {
    const t = await asaasFetch<{ id: string }>('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        value: input.amount,
        ...(input.pixKey ? { pixAddressKey: input.pixKey, operationType: 'PIX' } : {}),
      }),
    });
    return { providerWithdrawalId: t.id };
  },
};

/**
 * Cria uma subconta ASAAS para a escola (onboarding do split).
 * Retorna o walletId a ser salvo em schools.asaas_wallet_id.
 */
export async function asaasCreateSubaccount(input: {
  name: string; email: string; cpfCnpj: string; mobilePhone?: string;
  incomeValue?: number;
}): Promise<{ accountId: string; walletId: string; apiKey?: string }> {
  const acc = await asaasFetch<{ id: string; walletId: string; apiKey?: string }>('/accounts', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      mobilePhone: input.mobilePhone,
      incomeValue: input.incomeValue ?? 1000,
    }),
  });
  return { accountId: acc.id, walletId: acc.walletId, apiKey: acc.apiKey };
}
