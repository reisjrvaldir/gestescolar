import { useMemo, useState } from 'react';
import { Plus, ArrowRight, CreditCard, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';
import { currentMonthKey, monthKeyOf, monthLabel, shiftMonth } from '@/lib/months';
import type { Expense, ExpenseStatus } from '@/services/expenses';

const STATUS: Record<ExpenseStatus, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid: { tone: 'success', label: 'Pago' },
  pending: { tone: 'warning', label: 'Pendente' },
  overdue: { tone: 'danger', label: 'Vencido' },
};

interface Props {
  rows: Expense[];
  onNew?: () => void;
  onViewAll?: () => void;
}

/** Bloco resumido de Contas a pagar com navegação por mês (default = mês atual). */
export function PayablesCard({ rows, onNew, onViewAll }: Props) {
  /** null = "todos os meses". Padrão = mês atual. */
  const [monthKey, setMonthKey] = useState<string | null>(currentMonthKey());

  const visible = useMemo(() => {
    if (!monthKey) return rows;
    return rows.filter((r) => monthKeyOf(r.due_date) === monthKey);
  }, [rows, monthKey]);

  const totals = useMemo(() => {
    const pending = visible.filter((e) => e.status !== 'paid').reduce((s, e) => s + Number(e.amount), 0);
    const paid = visible.filter((e) => e.status === 'paid').reduce((s, e) => s + Number(e.amount), 0);
    return { pending, paid };
  }, [visible]);

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-ink">Contas a pagar</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Despesas da escola que impactam o saldo do mês.</p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
          onClick={onNew}
        >
          <Plus size={14} /> Nova despesa
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-canvas/40 px-5 py-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="rounded-lg border border-border bg-surface p-1 text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
            onClick={() => setMonthKey((k) => shiftMonth(k ?? currentMonthKey(), -1))}
            disabled={!monthKey}
            title="Mês anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="flex min-w-[170px] items-center justify-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
            <Calendar size={12} className="text-ink-muted" />
            {monthKey ? <span className="capitalize">{monthLabel(monthKey)}</span> : <span>Todos os meses</span>}
          </div>
          <button
            type="button"
            className="rounded-lg border border-border bg-surface p-1 text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
            onClick={() => setMonthKey((k) => shiftMonth(k ?? currentMonthKey(), 1))}
            disabled={!monthKey}
            title="Próximo mês"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-ink-muted">Pendente:</span>
          <span className="font-semibold text-warning">{brl(totals.pending)}</span>
          <span className="mx-1 text-ink-subtle">•</span>
          <span className="text-ink-muted">Pago:</span>
          <span className="font-semibold text-success">{brl(totals.paid)}</span>
          <button
            type="button"
            className={`ml-2 rounded-lg border border-border px-2 py-0.5 text-[11px] font-semibold ${!monthKey ? 'bg-primary text-white border-primary' : 'bg-surface text-ink-muted hover:bg-canvas'}`}
            onClick={() => setMonthKey((k) => (k ? null : currentMonthKey()))}
            title="Alternar entre o mês e todas as despesas"
          >
            {monthKey ? 'Todos' : 'Mês atual'}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={monthKey ? `Nenhuma despesa em ${monthLabel(monthKey)}` : 'Nenhuma despesa cadastrada'}
          description={monthKey
            ? 'Use as setas para navegar entre os meses ou clique em "Todos" para ver o histórico.'
            : 'Registre a primeira conta a pagar.'}
        />
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-sm">
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
              {visible.slice(0, 6).map((p) => (
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
                  <td className="px-5 py-2.5"><StatusBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</StatusBadge></td>
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
