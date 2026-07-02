import { Plus, ArrowRight, CreditCard } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';
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

/** Bloco resumido de Contas a pagar (despesas reais da escola). */
export function PayablesCard({ rows, onNew, onViewAll }: Props) {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-ink">Contas a pagar</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Despesas da escola que impactam o saldo do mês.</p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
          onClick={onNew}
        >
          <Plus size={14} /> Nova despesa
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={CreditCard} title="Nenhuma despesa cadastrada" description="Registre a primeira conta a pagar." />
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
              {rows.slice(0, 6).map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-canvas">
                  <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{fmtDate(p.due_date)}</td>
                  <td className="px-5 py-2.5 font-medium text-ink">{p.description || p.supplier_name}</td>
                  <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{p.category || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold text-ink">{brl(p.amount)}</td>
                  <td className="px-5 py-2.5"><StatusBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="flex items-center justify-center gap-1 border-t border-border px-5 py-3 text-xs font-semibold text-primary hover:bg-primary-soft/40" onClick={onViewAll}>
        Ver todas as contas a pagar <ArrowRight size={13} />
      </button>
    </div>
  );
}
