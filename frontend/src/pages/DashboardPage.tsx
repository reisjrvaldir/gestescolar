import { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap, School2, Users, Wallet, AlertTriangle, ClipboardCheck, Loader2,
  Mail, Star, RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { api } from '@/lib/api';
import { brl } from '@/lib/fees';

interface ChildStat {
  id: string;
  name: string;
  registration_number: string;
  monthly_fee: number;
  class_name?: string;
  present_month: number;
  absent_month: number;
  avg_grade: number;
  open_invoices: number;
}

interface DashboardStats {
  role: string;
  // admin
  students?: number;
  classes?: number;
  teachers?: number;
  revenue_month?: number;
  overdue_amount?: number;
  overdue_count?: number;
  attendance_today?: number;
  subscription_status?: string | null;
  trial_days_left?: number | null;
  // guardian
  children?: ChildStat[];
  unread_messages?: number;
}

const REFRESH_MS = 30_000;

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const r = await api.get<{ ok: boolean; data: DashboardStats }>('/dashboard/stats');
      setStats(r.data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto-refresh a cada 30s (realtime)
    const t = setInterval(() => fetchStats(true), REFRESH_MS);
    // Refetch quando a aba ganha foco novamente
    const onFocus = () => fetchStats(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchStats]);

  if (loading || !stats) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  const refreshIndicator = (
    <div className="mb-4 flex items-center justify-end gap-2 text-xs text-ink-subtle">
      <button
        type="button"
        onClick={() => fetchStats()}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-canvas hover:text-ink-muted"
        disabled={refreshing}
        title="Atualizar agora"
      >
        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Atualizando…' : 'Atualizar'}
      </button>
      {lastUpdated && (
        <span>• {lastUpdated.toLocaleTimeString('pt-BR')} (auto a cada 30s)</span>
      )}
    </div>
  );

  // -------------------- Dashboard do RESPONSÁVEL --------------------
  if (stats.role === 'guardian') {
    return (
      <>
        <PageHeader
          title="Início"
          subtitle="Acompanhe o desempenho e a rotina do(s) seu(s) filho(s)."
        />
        {refreshIndicator}

        {stats.unread_messages! > 0 && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary">
            <Mail size={18} />
            <span>Você tem <strong>{stats.unread_messages}</strong> mensagem(ns) não lida(s) da escola.</span>
          </div>
        )}

        {stats.children!.length === 0 ? (
          <div className="card p-8 text-center text-ink-muted">
            <GraduationCap size={48} className="mx-auto mb-2 text-ink-subtle" />
            <p>Nenhum aluno vinculado à sua conta.</p>
            <p className="mt-1 text-xs">Procure a secretaria da escola.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.children!.map((child) => (
              <div key={child.id} className="card p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-ink">{child.name}</h3>
                    <p className="text-sm text-ink-muted">
                      Matrícula <span className="font-mono">{child.registration_number}</span>
                      {child.class_name && ` • Turma: ${child.class_name}`}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-ink-muted">Mensalidade</p>
                    <p className="font-bold text-ink">{brl(Number(child.monthly_fee) || 0)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricCard label="Presenças no mês" value={child.present_month} icon={ClipboardCheck} tone="success" />
                  <MetricCard label="Faltas no mês" value={child.absent_month} icon={AlertTriangle} tone={child.absent_month > 0 ? 'warning' : 'primary'} />
                  <MetricCard label="Média no ano" value={Number(child.avg_grade).toFixed(1)} icon={Star} tone="primary" />
                  <MetricCard label="Faturas em aberto" value={child.open_invoices} icon={Wallet} tone={child.open_invoices > 0 ? 'danger' : 'success'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // -------------------- Dashboard ADMIN / FINANCEIRO / PROFESSOR --------------------
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral da sua escola, indicadores e atividades importantes."
      />
      {refreshIndicator}

      {stats.subscription_status === 'trialing' && stats.trial_days_left != null && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle size={18} />
          <span className="font-medium">Período de teste ativo</span>
          <span className="text-warning/80">
            — restam {stats.trial_days_left} dia{stats.trial_days_left !== 1 ? 's' : ''}. Escolha um plano para não perder o acesso.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Alunos" value={stats.students ?? 0} icon={GraduationCap} tone="primary" />
        <MetricCard label="Turmas" value={stats.classes ?? 0} icon={School2} tone="primary" />
        <MetricCard label="Professores" value={stats.teachers ?? 0} icon={Users} tone="primary" />
        <MetricCard label="Receitas do mês" value={brl(stats.revenue_month ?? 0)} icon={Wallet} tone="success" />
        <MetricCard label="Inadimplência" value={brl(stats.overdue_amount ?? 0)} icon={AlertTriangle} tone="danger" hint={`${stats.overdue_count ?? 0} fatura(s) vencida(s)`} />
        <MetricCard label="Chamadas hoje" value={stats.attendance_today ?? 0} icon={ClipboardCheck} tone="primary" />
      </div>
    </>
  );
}
