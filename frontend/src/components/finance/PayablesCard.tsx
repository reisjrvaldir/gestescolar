import { useMemo } from 'react';
import { Plus, ArrowRight, CreditCard } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';
import type { Expense, ExpenseStatus } from '@/services/expenses';
import type { Range } from '@/lib/period';

const STATUS: Record<ExpenseStatus, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid: { tone: 'success', label: 'Pago' },
  pending: { tone: 'warning', label: 'Pendente' },
  overdue: { tone: 'danger', label: 'Vencido' },
};

const PERIOD_SUFFIX: Record<string, string> = {
  month: 'do mês',
  quarter: 'do trimestre',
  half: 'do semestre',
  year: 'do ano',
};

interface Props {
  rows: Expense[];
  range: Range;
  onNew?: () => void;
  onViewAll?: () => void;
}

/** Bloco de Contas a pagar — consome o período unificado do FinancePage. */
export function PayablesCard({ rows, range, onNew, onViewAll }: Props) {
  const totals = useMemo(() => {
    const pending = rows.filter((e) => e.status !== 'paid').reduce((s, e) => s + Number(e.amount), 0);
    const paid = rows.filter((e) => e.status === 'paid').reduce((s, e) => s + Number(e.amount), 0);
    return { pending, paid };
  }, [rows]);

  const suffix = PERIOD_SUFFIX[range.period] ?? 'do período';

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-ink">Contas a pagar</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Despesas {suffix}:{' '}
            <span className="capitalize font-medium text-ink">{range.label}</span>.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
          onClick={onNew}
        >
          <Plus size={14} aria-hidden="true" /> Nova despesa
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-canvas/40 px-5 py-2.5 text-xs">
        <span className="text-ink-muted">Pendente:</span>
        <span className="font-semibold text-warning">{brl(totals.pending)}</span>
        <span className="text-ink-subtle">•</span>
        <span className="text-ink-muted">Pago:</span>
        <span className="font-semibold text-success">{brl(totals.paid)}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={`Nenhuma despesa ${suffix}`}
          description="Use o seletor de período acima para navegar entre os meses."
        />
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-sm" aria-label="Contas a pagar">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                <th className="px-5 py-2.5">Vencimento</th>
                <th className="px-5 py-2.5">Descrição</th>
                <th className="hidden px-5 py-2.5 sm:table-cell">Categoria</th>
                <th className="px-5 py-2.5 text-right">Valor</th>
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 6).map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-canvas">
                  <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{fmtDate(p.due_date)}</td>
                  <td className="px-5 py-2.5 font-medium text-ink">
                    {p.description || p.supplier_name}
                    {p.installment_number && p.installment_total && (
                      <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                        {p.installment_number}/{p.installment_total}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{p.category || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold text-ink">{brl(p.amount)}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        className="flex items-center justify-center gap-1 border-t border-border px-5 py-3 text-xs font-semibold text-primary hover:bg-primary-soft/40"
        onClick={onViewAll}
      >
        Ver todas as contas a pagar <ArrowRight size={13} />
      </button>
    </div>
  );
}
