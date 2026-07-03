import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fmtDate } from '@/lib/dates';
import type { RecentSchool } from '@/data/saas/dashboardData';

const TONE: Record<RecentSchool['status'], { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  ativa: { tone: 'success', label: 'Ativa' },
  trial: { tone: 'warning', label: 'Trial' },
  suspensa: { tone: 'warning', label: 'Suspensa' },
  cancelada: { tone: 'danger', label: 'Cancelada' },
};

export function RecentSchoolsTable({ rows }: { rows: RecentSchool[] }) {
  const navigate = useNavigate();
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h3 className="text-sm font-bold text-ink">Últimas escolas cadastradas</h3>
          <p className="text-xs text-ink-subtle">Novas contas nos últimos dias</p>
        </div>
        <button className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1" onClick={() => navigate('/saas/escolas')}>
          Ver todas <ArrowRight size={13} />
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
            <th className="px-5 py-2.5">Escola</th>
            <th className="hidden px-5 py-2.5 sm:table-cell">Plano</th>
            <th className="hidden px-5 py-2.5 md:table-cell">Cidade</th>
            <th className="px-5 py-2.5">Cadastro</th>
            <th className="px-5 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-border last:border-0 hover:bg-canvas">
              <td className="px-5 py-2.5 font-medium text-ink">{s.name}</td>
              <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{s.plan}</td>
              <td className="hidden px-5 py-2.5 text-ink-muted md:table-cell">{s.city}</td>
              <td className="px-5 py-2.5 text-ink-muted">{fmtDate(s.created_at)}</td>
              <td className="px-5 py-2.5"><StatusBadge tone={TONE[s.status].tone}>{TONE[s.status].label}</StatusBadge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
