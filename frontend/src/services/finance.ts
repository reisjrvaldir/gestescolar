import { api } from '@/lib/api';

export interface ExpenseCategorySlice {
  category: string;
  total: number;
}

export interface FinanceSummary {
  month: string;
  forecast_month: number;
  forecast_delta_pct: number | null;
  expenses_month: number;
  balance_month: number;
  delinquency_amount: number;
  delinquency_count: number;
  received_month: number;
  expenses_paid_month: number;
  expenses_by_category: ExpenseCategorySlice[];
}

export interface MonthlyBalancePoint {
  month: string;
  receitas: number;
  despesas: number;
}

export interface DelinquentInvoice {
  id: string;
  student_name: string;
  guardian_name?: string;
  plan_name?: string;
  amount: number;
  due_date: string;
  reference_month?: string;
  days_late: number;
}

export const financeService = {
  async summary(month?: string): Promise<FinanceSummary> {
    const q = month ? `?month=${month}` : '';
    const r = await api.get<{ ok: boolean; data: FinanceSummary }>(`/finance/summary${q}`);
    return r.data;
  },
  async monthly(): Promise<MonthlyBalancePoint[]> {
    const r = await api.get<{ ok: boolean; data: MonthlyBalancePoint[] }>('/finance/monthly');
    return r.data;
  },
  async delinquency(): Promise<DelinquentInvoice[]> {
    const r = await api.get<{ ok: boolean; data: DelinquentInvoice[] }>('/finance/delinquency');
    return r.data;
  },
};
