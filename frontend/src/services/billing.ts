import { api } from '@/lib/api';

export interface SubscribeInput {
  plan_id: string;
  cycle: 'monthly' | 'annual';
  installments?: number;
}

export const billingService = {
  /** Inicia a assinatura do plano — retorna o link de checkout hospedado
   *  (o cartão é inserido lá, nunca passa pelo nosso backend). */
  async subscribe(input: SubscribeInput): Promise<{ checkoutUrl: string }> {
    const r = await api.post<{ ok: boolean; data: { checkoutUrl: string } }>('/billing/subscribe', input);
    return r.data;
  },
};
