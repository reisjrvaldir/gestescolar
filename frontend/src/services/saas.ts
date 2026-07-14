import { api } from '@/lib/api';

export interface MonthPoint { month: string; revenue: number }
export interface DistItem { label: string; value: number }
export interface Slice extends DistItem { color: string }

export type SchoolDerivedStatus = 'ativa' | 'trial' | 'em_atraso' | 'suspensa' | 'cancelada';

export interface RecentSchool {
  id: string; name: string; plan: string; created_at: string; status: SchoolDerivedStatus;
}
export interface OverdueSchool {
  id: string; name: string; plan: string; days_late: number; amount: number;
}
export interface SaasActivity {
  type: 'school_created' | 'plan_changed' | 'payment_received' | 'school_suspended' | 'user_created';
  title: string; subtitle?: string; at: string;
}

export interface SaasMetrics {
  total_schools: number;
  new_this_month: number;
  active_schools: number;
  active_pct: number;
  revenue_month: number;
  revenue_delta_pct: number | null;
  overdue_schools: number;
  overdue_pct: number;
  active_users: number;
}

export interface SaasDashboard {
  metrics: SaasMetrics;
  revenue_series: MonthPoint[];
  plan_distribution: DistItem[];
  status_distribution: DistItem[];
  recent_schools: RecentSchool[];
  overdue_schools: OverdueSchool[];
  activities: SaasActivity[];
}

export interface SaasSchool {
  id: string; name: string; cnpj?: string; email?: string; phone?: string;
  created_at: string; trial_ends_at?: string;
  subscription_status?: string; school_status?: string;
  plan: string; derived_status: SchoolDerivedStatus;
  users_count: number; students_count: number;
}

export interface SaasRevenue {
  mrr: number;
  arr: number;
  active_count: number;
  avg_ticket: number;
  revenue_month: number;
  revenue_delta_pct: number | null;
  series: MonthPoint[];
  by_plan: DistItem[];
  recent: { id: string; school_name: string; amount: number; paid_at?: string; status: string }[];
}

export interface SaasPayouts {
  totals: { available: number; pending: number; gross: number; platform_fees: number; withdrawn: number };
  schools: {
    id: string; name: string;
    available_balance: number; pending_balance: number;
    gross_received_total: number; platform_fees_total: number; withdrawn_total: number;
  }[];
}

export interface SaasPlanFull {
  id: string;
  name: string;
  student_limit: number | null;
  monthly_price: number;
  annual_price: number;
  discount_percentage: number;
  is_public: boolean;
  is_pilot: boolean;
  features_json: string[];
  created_at: string;
  schools_count: number;
}

export type PlanInput = Omit<SaasPlanFull, 'id' | 'created_at' | 'schools_count'>;

export const saasService = {
  async dashboard(): Promise<SaasDashboard> {
    const r = await api.get<{ ok: boolean; data: SaasDashboard }>('/saas/dashboard');
    return r.data;
  },
  async plans(): Promise<SaasPlanFull[]> {
    const r = await api.get<{ ok: boolean; data: SaasPlanFull[] }>('/saas/plans');
    return r.data;
  },
  async createPlan(body: PlanInput): Promise<{ id: string }> {
    const r = await api.post<{ ok: boolean; data: { id: string } }>('/saas/plans', body);
    return r.data;
  },
  async updatePlan(id: string, body: PlanInput): Promise<{ id: string }> {
    const r = await api.put<{ ok: boolean; data: { id: string } }>(`/saas/plans/${id}`, body);
    return r.data;
  },
  async deletePlan(id: string): Promise<void> {
    await api.del(`/saas/plans/${id}`);
  },
  async revenue(): Promise<SaasRevenue> {
    const r = await api.get<{ ok: boolean; data: SaasRevenue }>('/saas/revenue');
    return r.data;
  },
  async payouts(): Promise<SaasPayouts> {
    const r = await api.get<{ ok: boolean; data: SaasPayouts }>('/saas/payouts');
    return r.data;
  },
  async schools(): Promise<SaasSchool[]> {
    const r = await api.get<{ ok: boolean; data: SaasSchool[] }>('/saas/schools');
    return r.data;
  },
  async extendAccess(id: string, body: { days?: number; until?: string; reason: string }) {
    const r = await api.post<{ ok: boolean; data: SaasSchool }>(`/saas/schools/${id}/extend`, body);
    return r.data;
  },
  async suspendSchool(id: string, reason: string) {
    const r = await api.post<{ ok: boolean; data: SaasSchool }>(`/saas/schools/${id}/suspend`, { reason });
    return r.data;
  },
  async reactivateSchool(id: string, body: { reason?: string; trial_days?: number }) {
    const r = await api.post<{ ok: boolean; data: SaasSchool }>(`/saas/schools/${id}/reactivate`, body);
    return r.data;
  },
};

// Paleta fixa para os donuts (o backend devolve só label/value).
const PLAN_COLORS = ['#2563EB', '#7C3AED', '#16A34A', '#F59E0B', '#64748B', '#0EA5A4'];
const STATUS_COLORS: Record<string, string> = {
  ativa: '#16A34A', trial: '#2563EB', em_atraso: '#EF4444', suspensa: '#F59E0B', cancelada: '#64748B',
};
const STATUS_LABELS: Record<string, string> = {
  ativa: 'Ativas', trial: 'Trial', em_atraso: 'Em atraso', suspensa: 'Suspensas', cancelada: 'Canceladas',
};

export function toPlanSlices(items: DistItem[]): Slice[] {
  return items.map((it, i) => ({ ...it, color: PLAN_COLORS[i % PLAN_COLORS.length] }));
}
export function toStatusSlices(items: DistItem[]): Slice[] {
  return items.map((it) => ({
    label: STATUS_LABELS[it.label] ?? it.label,
    value: it.value,
    color: STATUS_COLORS[it.label] ?? '#64748B',
  }));
}
