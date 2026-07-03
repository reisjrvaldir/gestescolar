import { useState } from 'react';
import { CalendarDays, Download, Check } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCards } from '../components/StatCards';
import { RevenueChart } from '../components/RevenueChart';
import { DonutChart } from '../components/DonutChart';
import { RecentSchoolsTable } from '../components/RecentSchoolsTable';
import { OverdueSchoolsTable } from '../components/OverdueSchoolsTable';
import { ActivitiesFeed } from '../components/ActivitiesFeed';
import { QuickActions } from '../components/QuickActions';
import {
  saasDashboardStats, saasRevenueSeries, saasPlanDistribution, saasSchoolStatus,
  saasRecentSchools, saasOverdueSchools, saasActivities,
} from '@/data/saas/dashboardData';

export function SaasDashboardPage() {
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  return (
    <>
      <PageHeader
        title="Dashboard Super Admin"
        subtitle="Visão geral completa da plataforma GestEscolar"
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink md:flex">
              <CalendarDays size={15} className="text-ink-subtle" />
              01/05/2025 — 31/05/2025
            </div>
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
        <StatCards cards={saasDashboardStats} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2"><RevenueChart data={saasRevenueSeries} /></div>
          <DonutChart title="Distribuição de planos" slices={saasPlanDistribution} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2"><RecentSchoolsTable rows={saasRecentSchools} /></div>
          <DonutChart title="Status das escolas" slices={saasSchoolStatus} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <OverdueSchoolsTable rows={saasOverdueSchools} />
          <ActivitiesFeed items={saasActivities} />
        </div>

        <QuickActions onToast={showToast} />
      </div>
    </>
  );
}
