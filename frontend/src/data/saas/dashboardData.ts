// Dados mockados do Dashboard do Super Admin.
// Integração futura: GET /api/saas/dashboard/summary + /revenue-series +
// /plan-distribution + /status-distribution + /activities. Preservar o
// mesmo formato para a UI não precisar mudar quando conectar ao banco.

export interface StatCard {
  key: string;
  label: string;
  value: string;
  hint: string;
  hintTone: 'success' | 'danger' | 'muted';
  tone: 'primary' | 'success' | 'danger' | 'warning' | 'purple';
  icon: 'schools' | 'active' | 'revenue' | 'overdue' | 'users';
}

export const saasDashboardStats: StatCard[] = [
  { key: 'schools', label: 'Escolas cadastradas', value: '248', hint: '+18 novas este mês', hintTone: 'success', tone: 'primary', icon: 'schools' },
  { key: 'active', label: 'Escolas ativas', value: '210', hint: '84,7% do total', hintTone: 'muted', tone: 'success', icon: 'active' },
  { key: 'revenue', label: 'Receita do mês (SaaS)', value: 'R$ 48.750,90', hint: '+23,4% vs mês anterior', hintTone: 'success', tone: 'purple', icon: 'revenue' },
  { key: 'overdue', label: 'Escolas em atraso', value: '12', hint: '4,8% do total', hintTone: 'danger', tone: 'danger', icon: 'overdue' },
  { key: 'users', label: 'Usuários ativos', value: '1.842', hint: '+12,7% vs mês anterior', hintTone: 'success', tone: 'primary', icon: 'users' },
];

// ------------- Séries e distribuições -------------

export interface MonthPoint { month: string; revenue: number }
export const saasRevenueSeries: MonthPoint[] = [
  { month: 'Jun/24', revenue: 27400 }, { month: 'Jul/24', revenue: 29800 },
  { month: 'Ago/24', revenue: 31200 }, { month: 'Set/24', revenue: 33450 },
  { month: 'Out/24', revenue: 35100 }, { month: 'Nov/24', revenue: 36800 },
  { month: 'Dez/24', revenue: 34200 }, { month: 'Jan/25', revenue: 38900 },
  { month: 'Fev/25', revenue: 40100 }, { month: 'Mar/25', revenue: 42800 },
  { month: 'Abr/25', revenue: 44950 }, { month: 'Mai/25', revenue: 48750 },
];

export interface Slice { label: string; value: number; color: string }
export const saasPlanDistribution: Slice[] = [
  { label: 'Básico',       value: 92, color: '#2563EB' },
  { label: 'Profissional', value: 108, color: '#7C3AED' },
  { label: 'Enterprise',   value: 32, color: '#16A34A' },
  { label: 'Personalizado', value: 16, color: '#F59E0B' },
];
export const saasSchoolStatus: Slice[] = [
  { label: 'Ativas',      value: 210, color: '#16A34A' },
  { label: 'Em atraso',   value: 12,  color: '#EF4444' },
  { label: 'Suspensas',   value: 8,   color: '#F59E0B' },
  { label: 'Canceladas',  value: 18,  color: '#64748B' },
];

// ------------- Tabelas -------------

export interface RecentSchool {
  id: string; name: string; plan: string; city: string; created_at: string;
  status: 'ativa' | 'trial' | 'suspensa' | 'cancelada';
}
export const saasRecentSchools: RecentSchool[] = [
  { id: 's_301', name: 'Colégio Aurora', plan: 'Profissional', city: 'São Paulo/SP', created_at: '2026-05-20', status: 'ativa' },
  { id: 's_302', name: 'Instituto Novo Rumo', plan: 'Básico', city: 'Curitiba/PR', created_at: '2026-05-18', status: 'trial' },
  { id: 's_303', name: 'Escola Alfa & Beto', plan: 'Enterprise', city: 'Belo Horizonte/MG', created_at: '2026-05-15', status: 'ativa' },
  { id: 's_304', name: 'Colégio Semear', plan: 'Profissional', city: 'Fortaleza/CE', created_at: '2026-05-12', status: 'ativa' },
  { id: 's_305', name: 'Escolinha Girassol', plan: 'Básico', city: 'Porto Alegre/RS', created_at: '2026-05-10', status: 'trial' },
];

export interface OverdueSchool { id: string; name: string; plan: string; days_late: number; amount: number }
export const saasOverdueSchools: OverdueSchool[] = [
  { id: 's_150', name: 'Instituto Educare', plan: 'Profissional', days_late: 12, amount: 249.90 },
  { id: 's_162', name: 'Colégio Prisma',    plan: 'Básico',       days_late: 8,  amount: 149.90 },
  { id: 's_178', name: 'Escola Aprender+',  plan: 'Enterprise',   days_late: 21, amount: 599.90 },
  { id: 's_193', name: 'Colégio Sabedoria', plan: 'Profissional', days_late: 5,  amount: 249.90 },
  { id: 's_201', name: 'Rede Educar',       plan: 'Básico',       days_late: 3,  amount: 149.90 },
];

export interface Activity {
  id: string; type: 'school_created' | 'plan_changed' | 'payment_received' | 'school_suspended' | 'user_created';
  title: string; subtitle?: string; at: string;
}
export const saasActivities: Activity[] = [
  { id: 'a_1', type: 'school_created',    title: 'Nova escola cadastrada', subtitle: 'Colégio Aurora — Profissional', at: '2026-05-20T09:12:00Z' },
  { id: 'a_2', type: 'payment_received',  title: 'Pagamento recebido', subtitle: 'Instituto Novo Rumo — R$ 149,90', at: '2026-05-20T08:45:00Z' },
  { id: 'a_3', type: 'plan_changed',      title: 'Plano alterado', subtitle: 'Colégio Horizonte: Básico → Profissional', at: '2026-05-19T17:30:00Z' },
  { id: 'a_4', type: 'school_suspended',  title: 'Escola suspensa', subtitle: 'Escola Aprender+ — 21 dias em atraso', at: '2026-05-19T14:20:00Z' },
  { id: 'a_5', type: 'user_created',      title: 'Novo usuário administrativo', subtitle: 'suporte.pedro@gestescolar.com.br', at: '2026-05-19T10:05:00Z' },
];
