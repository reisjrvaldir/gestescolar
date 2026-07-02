import { ArrowRight, Info, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { brl } from '@/lib/fees';
import type { DelinquentInvoice } from '@/services/finance';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

interface Props {
  rows: DelinquentInvoice[];
  onViewAll?: () => void;
}

/** Bloco de Inadimplência (mensalidades vencidas e não pagas, dados reais). */
export function DelinquencyCard({ rows, onViewAll }: Props) {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-bold text-ink">Inadimplência</h3>
        <p className="mt-0.5 text-xs text-ink-muted">Mensalidades não pagas e em atraso.</p>
      </div>

      <div className="flex items-start gap-2 border-b border-border bg-purple-soft/50 px-5 py-3 text-xs text-purple">
        <Info size={15} className="mt-0.5 shrink-0" />
        <span>
          Ao criar o aluno e vinculá-lo a um plano, o sistema gera cobranças via PIX para todos os
          meses do ano a partir da matrícula.
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <CheckCircle2 size={28} className="text-success" />
          <p className="text-sm font-medium text-ink">Nenhum aluno inadimplente</p>
          <p className="text-xs text-ink-muted">Todas as mensalidades estão em dia.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                <th className="px-5 py-2.5">Aluno</th>
                <th className="hidden px-5 py-2.5 lg:table-cell">Responsável</th>
                <th className="hidden px-5 py-2.5 sm:table-cell">Plano</th>
                <th className="px-5 py-2.5">Venc.</th>
                <th className="px-5 py-2.5 text-center">Atraso</th>
                <th className="px-5 py-2.5 text-right">Valor</th>
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-canvas">
                  <td className="px-5 py-2.5 font-medium text-ink">{d.student_name}</td>
                  <td className="hidden px-5 py-2.5 text-ink-muted lg:table-cell">{d.guardian_name ?? '—'}</td>
                  <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{d.plan_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{fmtDate(d.due_date)}</td>
                  <td className="px-5 py-2.5 text-center font-semibold text-danger">{d.days_late}d</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold text-ink">{brl(d.amount)}</td>
                  <td className="px-5 py-2.5"><StatusBadge tone="danger">Em atraso</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="flex items-center justify-center gap-1 border-t border-border px-5 py-3 text-xs font-semibold text-primary hover:bg-primary-soft/40" onClick={onViewAll}>
        Ver todos inadimplentes <ArrowRight size={13} />
      </button>
    </div>
  );
}
