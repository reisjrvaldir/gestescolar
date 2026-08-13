// =============================================================
//  Abstração de provedor de pagamento (gateway-agnóstica).
//  Implementações: ASAAS (real) e Simulação (fallback de teste).
//  A lógica de split/saldo/baixa fica em settlement.ts (agnóstica).
// =============================================================

// Só PIX e cartão de crédito, por decisão de produto — boleto não é oferecido.
// Por isso NÃO usamos o 'UNDEFINED' do ASAAS: nesse modo quem decide os
// métodos exibidos é a configuração da conta, e o boleto entraria junto.
// Fixar o billingType é o que garante o controle. O custo é que a cobrança
// tem um método só: trocar exige cancelar e recriar (ver card-checkout).
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
  /** Multa por atraso: percentual FIXO aplicado uma vez após o vencimento. */
  finePct?: number;
  /** Juros de mora: percentual AO MÊS (aplicado pro-rata/dia após o vencimento). */
  interestPct?: number;
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
  // PAYMENT_FAILED: cartão recusado (sem limite, vencido, bloqueado). Importa
  // no pagamento recorrente — a fatura do mês volta para PIX para o
  // responsável não ficar sem forma de pagar.
  type: 'PAYMENT_CONFIRMED' | 'PAYMENT_RECEIVED' | 'PAYMENT_FAILED' | 'OTHER';
  providerPaymentId: string;
  providerChargeId?: string;
  amount?: number;
  billingType?: BillingType;
  /** Referência externa que enviamos na criação = invoiceId. */
  externalReference?: string;
  /** Presente quando a cobrança veio de uma assinatura recorrente — é por ele
   *  que localizamos qual recorrência falhou ou foi cobrada. */
  providerSubscriptionId?: string;
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
  /** Cancela uma cobrança no provedor. Necessário ao trocar a forma de
   *  pagamento: sem cancelar a anterior, a fatura fica com DUAS cobranças
   *  pagáveis no ASAAS e o responsável pode pagar duas vezes.
   *  Idempotente — cancelar algo já cancelado/inexistente não deve lançar. */
  cancelCharge(providerChargeId: string): Promise<void>;
}
