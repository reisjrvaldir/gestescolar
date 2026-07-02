// =============================================================
//  Ponto único de acesso à camada de pagamentos.
//  getPaymentProvider() escolhe o provedor conforme a configuração:
//    ASAAS_API_KEY definido → ASAAS; caso contrário → Simulação.
// =============================================================
import type { PaymentProvider } from './types';
import { asaasProvider, isAsaasConfigured } from './asaas';
import { simulationProvider } from './simulation';

export * from './types';
export { isAsaasConfigured } from './asaas';
export { asaasCreateSubaccount, asaasCreateSubscription, asaasCreateInstallmentCharge, asaasEnsureBillingCustomer } from './asaas';
export { processConfirmedPayment, processSubscriptionPayment } from './settlement';
export { buildChargeForInvoice } from './invoiceCharge';

/** Provedor de pagamento ativo (ASAAS quando configurado, senão simulação). */
export function getPaymentProvider(): PaymentProvider {
  return isAsaasConfigured ? asaasProvider : simulationProvider;
}

/** Nome do provedor ativo (para gravar em payments.provider). */
export function activeProviderName(): string {
  return getPaymentProvider().name;
}
