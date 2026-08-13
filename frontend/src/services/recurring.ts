// Pagamento recorrente no cartão, cadastrado pelo responsável.
// O cartão é digitado no checkout do provedor — nunca em tela nossa.
import { api } from '@/lib/api';

export type RecurringStatus = 'pending' | 'active' | 'failed' | 'cancelled';

export interface RecurringStudent {
  student_id: string;
  student_name: string;
  monthly_fee: number | null;
  recurring_id: string | null;
  status: RecurringStatus | null;
  last_error: string | null;
  last_charged_at: string | null;
  amount: number | null;
}

export const recurringService = {
  async list(): Promise<RecurringStudent[]> {
    const r = await api.get<{ ok: boolean; data: RecurringStudent[] }>('/recurring');
    return r.data;
  },
  /** Cria a assinatura e devolve o checkout onde o cartão será cadastrado. */
  async enable(studentId: string): Promise<{ checkout_url: string | null; amount: number }> {
    const r = await api.post<{ ok: boolean; data: { checkout_url: string | null; amount: number } }>(
      `/recurring/${studentId}`,
    );
    return r.data;
  },
  async cancel(studentId: string): Promise<void> {
    await api.del(`/recurring/${studentId}`);
  },
};
