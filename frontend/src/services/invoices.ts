import { api } from '@/lib/api';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

export interface Invoice {
  id: string;
  student_name: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  payment_method?: 'pix' | 'card';
  paid_at?: string;
  created_at?: string;
}

export interface NewInvoice {
  student_name: string;
  amount: number;
  due_date?: string;
}

export const invoicesService = {
  async list(): Promise<Invoice[]> {
    const res = await api.get<{ ok: boolean; data: Invoice[] }>('/invoices');
    return res.data;
  },

  async create(data: NewInvoice): Promise<Invoice> {
    const res = await api.post<{ ok: boolean; data: Invoice }>('/invoices', data);
    return res.data;
  },
};
