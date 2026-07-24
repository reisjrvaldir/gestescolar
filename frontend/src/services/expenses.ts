import { api } from '@/lib/api';

export type ExpenseStatus = 'pending' | 'paid' | 'overdue';

/** Categorias de despesa (para classificar os gastos da escola). */
export const EXPENSE_CATEGORIES = [
  'Infraestrutura',
  'Material',
  'Pessoal',
  'Custo fixo',
  'Serviços',
  'Impostos',
  'Marketing',
  'Outros',
] as const;

export interface Expense {
  id: string;
  supplier_name: string;
  description?: string | null;
  category?: string | null;
  amount: number;
  due_date?: string | null;
  status: ExpenseStatus;
  paid_at?: string | null;
  deleted_at?: string | null;
  installment_group_id?: string | null;
  installment_number?: number | null;
  installment_total?: number | null;
  created_at: string;
  updated_at?: string;
}

export interface NewExpense {
  supplier_name: string;
  description?: string;
  category?: string;
  amount: number;
  due_date?: string;
  installments?: number;
  /** 'total' = amount é o valor total dividido em N parcelas;
   *  'each'  = amount é o valor de CADA parcela. */
  installment_mode?: 'total' | 'each';
}

export interface EditExpense {
  supplier_name?: string;
  description?: string;
  category?: string;
  amount?: number;
  due_date?: string;
}

export interface ListFilters {
  trash?: boolean;
  status?: ExpenseStatus;
  category?: string;
  supplier?: string;
  from?: string;
  to?: string;
}

export interface AuditEntry {
  id: string;
  expense_id: string;
  action: 'create' | 'update' | 'pay' | 'unpay' | 'delete' | 'restore' | 'purge';
  actor_name?: string | null;
  actor_role?: string | null;
  before?: any;
  after?: any;
  created_at: string;
}

function qs(f: ListFilters): string {
  const p = new URLSearchParams();
  if (f.trash) p.set('trash', 'true');
  if (f.status) p.set('status', f.status);
  if (f.category) p.set('category', f.category);
  if (f.supplier) p.set('supplier', f.supplier);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const expensesService = {
  async list(filters: ListFilters = {}): Promise<Expense[]> {
    const r = await api.get<{ ok: boolean; data: Expense[] }>(`/expenses${qs(filters)}`);
    return r.data;
  },
  async create(data: NewExpense): Promise<Expense[]> {
    const r = await api.post<{ ok: boolean; data: Expense[] }>('/expenses', data);
    return r.data;
  },
  async update(id: string, data: EditExpense): Promise<Expense> {
    const r = await api.patch<{ ok: boolean; data: Expense }>(`/expenses/${id}`, data);
    return r.data;
  },
  async markPaid(id: string): Promise<Expense> {
    const r = await api.patch<{ ok: boolean; data: Expense }>(`/expenses/${id}/pay`);
    return r.data;
  },
  async markUnpaid(id: string): Promise<Expense> {
    const r = await api.patch<{ ok: boolean; data: Expense }>(`/expenses/${id}/unpay`);
    return r.data;
  },
  async remove(id: string): Promise<void> {
    await api.del(`/expenses/${id}`);
  },
  async restore(id: string): Promise<Expense> {
    const r = await api.post<{ ok: boolean; data: Expense }>(`/expenses/${id}/restore`);
    return r.data;
  },
  async purge(id: string): Promise<void> {
    await api.del(`/expenses/${id}/purge`);
  },
  async audit(filters: { from?: string; to?: string; action?: string; expense_id?: string } = {}): Promise<AuditEntry[]> {
    const p = new URLSearchParams();
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
    if (filters.action) p.set('action', filters.action);
    if (filters.expense_id) p.set('expense_id', filters.expense_id);
    const s = p.toString();
    const r = await api.get<{ ok: boolean; data: AuditEntry[] }>(`/expenses/audit${s ? `?${s}` : ''}`);
    return r.data;
  },
};
