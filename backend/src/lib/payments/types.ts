// =============================================================
//  Abstração de provedor de pagamento (gateway-agnóstica).
//  Implementações: ASAAS (real) e Simulação (fallback de teste).
//  A lógica de split/saldo/baixa fica em settlement.ts (agnóstica).
// =============================================================

export type BillingType = 'PIX' | 'CREDIT_CARD';

/** Alvo de split: uma carteira ASAAS (subconta da escola) recebe parte do valor. */
export interface SplitTarget {
  walletId: string;
  fixedValue?: number;       // valor fixo (R$) destinado à carteira
  percentualValue?: number;  // ou percentual (0–100)
}

export interface ChargeCustomer {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  /** Se já existir cliente no provedor, reaproveita (evita recriar). */
  providerCustomerId?: string;
}

export interface CreateChargeInput {
  invoiceId: string;         // usado como externalReference no provedor
  amount: number;
  description: string;
  billingType: BillingType;
  dueDate?: string;          // yyyy-mm-dd (default: hoje)
  customer?: ChargeCustomer;
  split?: SplitTarget[];
}

export interface ChargeResult {
  providerChargeId: string;
  billingType: BillingType;
  status: string;
  amount: number;
  pixQrCode?: string;        // imagem base64 do QR (PIX)
  pixCopyPaste?: string;     // payload copia-e-cola (PIX)
  invoiceUrl?: string;       // checkout hospedado (cartão — evita tocar dados do cartão)
  providerCustomerId?: string;
}

/** Evento de webhook normalizado (independente do provedor). */
export interface NormalizedWebhookEvent {
  type: 'PAYMENT_CONFIRMED' | 'PAYMENT_RECEIVED' | 'OTHER';
  providerPaymentId: string;
  providerChargeId?: string;
  amount?: number;
  billingType?: BillingType;
  /** Referência externa que enviamos na criação = invoiceId. */
  externalReference?: string;
  rawType: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** Cria a cobrança (PIX gera QR/copia-e-cola; cartão retorna invoiceUrl). */
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  /** Valida a autenticidade do webhook (token/assinatura). */
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): boolean;
  /** Normaliza o corpo do webhook para o evento agnóstico (ou null se irrelevante). */
  parseWebhook(body: unknown): NormalizedWebhookEvent | null;
  /** Solicita transferência/saque do saldo (opcional conforme provedor). */
  requestWithdrawal(input: { amount: number; pixKey?: string }): Promise<{ providerWithdrawalId: string }>;
}
