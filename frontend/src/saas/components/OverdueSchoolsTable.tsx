import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { brl } from '@/lib/fees';
import type { OverdueSchool } from '@/services/saas';

export function OverdueSchoolsTable({ rows }: { rows: OverdueSchool[] }) {
  const navigate = useNavigate();
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <h3 className="inline-flex items-center gap-2 text-sm font-bold text-ink">
            <AlertTriangle size={15} className="text-danger" /> Escolas com pagamentos em atraso
          </h3>
          <p className="text-xs text-ink-subtle">Ordenadas por dias em atraso</p>
        </div>
        <button className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1" onClick={() => navigate('/saas/vencimentos')}>
          Ver vencimentos <ArrowRight size={13} />
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
            <th className="px-5 py-2.5">Escola</th>
            <th className="hidden px-5 py-2.5 sm:table-cell">Plano</th>
            <th className="px-5 py-2.5 text-center">Atraso</th>
            <th className="px-5 py-2.5 text-right">Valor devido</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-border last:border-0 hover:bg-canvas">
              <td className="px-5 py-2.5 font-medium text-ink">{s.name}</td>
              <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{s.plan}</td>
              <td className="px-5 py-2.5 text-center font-semibold text-danger">{s.days_late}d</td>
              <td className="px-5 py-2.5 text-right font-semibold text-ink">{brl(s.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
