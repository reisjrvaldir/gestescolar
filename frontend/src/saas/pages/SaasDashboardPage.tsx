import { useEffect, useState } from 'react';
import { CalendarDays, Download, Check, Loader2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCards } from '../components/StatCards';
import { RevenueChart } from '../components/RevenueChart';
import { DonutChart } from '../components/DonutChart';
import { RecentSchoolsTable } from '../components/RecentSchoolsTable';
import { OverdueSchoolsTable } from '../components/OverdueSchoolsTable';
import { ActivitiesFeed } from '../components/ActivitiesFeed';
import { QuickActions } from '../components/QuickActions';
import { saasService, toPlanSlices, toStatusSlices, type SaasDashboard } from '@/services/saas';

export function SaasDashboardPage() {
  const [data, setData] = useState<SaasDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await saasService.dashboard());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar o painel.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando dados reais da plataforma…</span></div>;
  }
  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-danger">{error ?? 'Sem dados.'}</p>
        <button className="btn-outline mt-4" onClick={load}><RefreshCw size={15} /> Tentar novamente</button>
      </div>
    );
  }

  const now = new Date();
  const periodo = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <>
      <PageHeader
        title="Dashboard Super Admin"
        subtitle="Visão geral completa da plataforma GestEscolar"
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm capitalize text-ink md:flex">
              <CalendarDays size={15} className="text-ink-subtle" />
              {periodo}
            </div>
            <button className="btn-outline" onClick={load} title="Atualizar"><RefreshCw size={15} /></button>
            <button className="btn-primary" onClick={() => showToast('Exportação de relatório — disponível em breve.')}>
              <Download size={15} /> Exportar relatório
            </button>
          </div>
        }
      />

      {toast && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-success-soft px-4 py-2.5 text-sm font-medium text-success">
          <Check size={16} /> {toast}
        </div>
      )}

      <div className="space-y-6">
        <StatCards metrics={data.metrics} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2"><RevenueChart data={data.revenue_series} /></div>
          <DonutChart title="Distribuição de planos" slices={toPlanSlices(data.plan_distribution)} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2"><RecentSchoolsTable rows={data.recent_schools} /></div>
          <DonutChart title="Status das escolas" slices={toStatusSlices(data.status_distribution)} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <OverdueSchoolsTable rows={data.overdue_schools} />
          <ActivitiesFeed items={data.activities} />
        </div>

        <QuickActions onToast={showToast} />
      </div>
    </>
  );
}
