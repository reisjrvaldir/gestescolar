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
  description?: string;
  category?: string;
  amount: number;
  due_date?: string;
  status: ExpenseStatus;
  created_at: string;
}

export interface NewExpense {
  supplier_name: string;
  description?: string;
  category?: string;
  amount: number;
  due_date?: string;
}

export const expensesService = {
  async list(): Promise<Expense[]> {
    const r = await api.get<{ ok: boolean; data: Expense[] }>('/expenses');
    return r.data;
  },
  async create(data: NewExpense): Promise<Expense> {
    const r = await api.post<{ ok: boolean; data: Expense }>('/expenses', data);
    return r.data;
  },
  async markPaid(id: string): Promise<void> {
    await api.patch(`/expenses/${id}/pay`);
  },
  async remove(id: string): Promise<void> {
    await api.del(`/expenses/${id}`);
  },
};
