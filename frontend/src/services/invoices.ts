import { api } from '@/lib/api';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type InvoiceKind = 'mensalidade' | 'avulsa' | 'matricula';

export interface Invoice {
  id: string;
  student_name: string;
  guardian_name?: string;
  class_name?: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  kind?: InvoiceKind;
  reference_month?: string;
  payment_method?: 'pix' | 'card';
  checkout_url?: string;
  paid_at?: string;
  created_at?: string;
}

export interface MyInvoice extends Invoice {
  pix_qr_code?: string;
  pix_copy_paste?: string;
  charge_title?: string;
  charge_description?: string;
}

export interface ChargeResult {
  providerChargeId: string;
  billingType: 'PIX' | 'CREDIT_CARD';
  status: string;
  amount: number;
  pixQrCode?: string;
  pixCopyPaste?: string;
  invoiceUrl?: string;
}

export const invoicesService = {
  async list(): Promise<Invoice[]> {
    const res = await api.get<{ ok: boolean; data: Invoice[] }>('/invoices');
    return res.data;
  },

  /** Faturas do(s) aluno(s) do responsável autenticado. */
  async mine(): Promise<MyInvoice[]> {
    const res = await api.get<{ ok: boolean; data: MyInvoice[] }>('/invoices/mine');
    return res.data;
  },

  /** Gera (ou renova) a cobrança PIX da fatura — usado pelo botão "Enviar cobrança". */
  async generatePix(id: string): Promise<ChargeResult> {
    const res = await api.post<{ ok: boolean; data: ChargeResult }>(`/invoices/${id}/pix`);
    return res.data;
  },

  /** Gera uma cobrança PIX ou cartão para a fatura. */
  async charge(id: string, billingType: 'PIX' | 'CREDIT_CARD' = 'PIX'): Promise<ChargeResult> {
    const res = await api.post<{ ok: boolean; data: ChargeResult }>(`/invoices/${id}/charge`, { billingType });
    return res.data;
  },
};
