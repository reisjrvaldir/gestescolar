import { api } from '@/lib/api';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type InvoiceKind = 'mensalidade' | 'avulsa' | 'matricula';

export interface Invoice {
  id: string;
  student_name: string;
  guardian_name?: string;
  class_name?: string;
  registration_number?: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  kind?: InvoiceKind;
  reference_month?: string;
  payment_method?: 'pix' | 'card' | 'cash' | 'other';
  checkout_url?: string;
  paid_at?: string;
  created_at?: string;
}

export interface MyInvoice extends Invoice {
  pix_qr_code?: string;
  pix_copy_paste?: string;
  charge_title?: string;
  charge_description?: string;
  guardian_response?: 'declined' | 'disputed' | null;
  guardian_response_note?: string | null;
  guardian_response_at?: string | null;
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

  /** Garante que a fatura aceite PIX e cartão e devolve o link do checkout do
   *  provedor, onde o cartão é digitado — nunca em tela nossa.
   *  `pix_changed` indica que a cobrança precisou ser recriada (fatura antiga,
   *  emitida só como PIX), então o código PIX exibido ficou obsoleto. */
  async cardCheckout(id: string): Promise<{ checkout_url: string; pix_changed: boolean }> {
    const res = await api.post<{ ok: boolean; data: { checkout_url: string; pix_changed: boolean } }>(
      `/invoices/${id}/card-checkout`,
    );
    return res.data;
  },

  /** Gera PIX (se preciso) e envia o copia-e-cola ao responsável via mensagem interna. */
  async sendChargeToGuardian(id: string): Promise<{ sent_to: string; copy_paste: string }> {
    const res = await api.post<{ ok: boolean; data: { sent_to: string; copy_paste: string } }>(
      `/invoices/${id}/send-to-guardian`,
    );
    return res.data;
  },

  /** Resposta do responsável a uma cobrança avulsa em aberto:
   *  - 'decline'  → não vai participar; cancela a fatura.
   *  - 'dispute'  → quer mais informações; fatura fica pendente + sinalizada. */
  async respondToAvulsa(id: string, action: 'decline' | 'dispute', note?: string): Promise<void> {
    await api.post(`/invoices/${id}/guardian-response`, { action, note });
  },

  /** Registra pagamento recebido offline (dinheiro/na escola). Não entra no saldo sacável. */
  async registerManualPayment(
    id: string,
    input: { payment_method: 'cash' | 'pix' | 'card' | 'other'; paid_at?: string },
  ): Promise<Invoice> {
    const res = await api.post<{ ok: boolean; data: Invoice }>(`/invoices/${id}/manual-payment`, input);
    return res.data;
  },
};
