import { api } from '@/lib/api';

export interface ChargeBatch {
  id: string;
  title: string;
  description?: string;
  amount: number;
  due_date: string;
  scope: 'all' | 'class';
  class_id?: string;
  class_name?: string;
  invoices_count: number;
  paid_count: number;
  created_at: string;
}

export interface NewAdhocCharge {
  title: string;
  description?: string;
  amount: number;
  due_date: string;
  scope: 'all' | 'class';
  class_id?: string;
}

export const chargesService = {
  async list(): Promise<ChargeBatch[]> {
    const r = await api.get<{ ok: boolean; data: ChargeBatch[] }>('/charges');
    return r.data;
  },
  async create(data: NewAdhocCharge): Promise<{ batch_id: string; students_count: number; invoices_created: number }> {
    const r = await api.post<{ ok: boolean; data: { batch_id: string; students_count: number; invoices_created: number } }>('/charges', data);
    return r.data;
  },
};
