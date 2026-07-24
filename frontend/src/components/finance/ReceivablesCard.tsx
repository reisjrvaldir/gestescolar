import { useMemo, useState } from 'react';
import { Plus, ArrowRight, Send, Loader2, Wallet, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';
import { currentMonthKey, monthKeyOf, monthLabel, shiftMonth } from '@/lib/months';
import type { Invoice, InvoiceStatus } from '@/services/invoices';

const STATUS: Record<InvoiceStatus, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid: { tone: 'success', label: 'Pago' },
  pending: { tone: 'warning', label: 'Aberto' },
  overdue: { tone: 'danger', label: 'Em atraso' },
  cancelled: { tone: 'danger', label: 'Cancelado' },
  refunded: { tone: 'warning', label: 'Estornado' },
};

interface Props {
  rows: Invoice[];
  onNew?: () => void;
  onSend?: (id: string) => void;
  onViewAll?: () => void;
  sendingId?: string | null;
}

/** Mês de referência da fatura: usa reference_month; senão, o mês do vencimento. */
function invoiceMonth(r: Invoice): string | null {
  if (r.reference_month) return String(r.reference_month).slice(0, 7);
  return monthKeyOf(r.due_date);
}

/** Bloco de A receber — mostra as cobranças em aberto do mês selecionado, com
 *  navegação entre meses (padrão = mês atual), opção "Todos" e totalizadores. */
export function ReceivablesCard({ rows, onNew, onSend, onViewAll, sendingId }: Props) {
  /** null = "todos os meses". Padrão = mês atual. */
  const [monthKey, setMonthKey] = useState<string | null>(currentMonthKey());

  /** Só cobranças em aberto (pending/overdue/refunded) — pagas e canceladas ficam fora. */
  const openRows = useMemo(
    () => rows.filter((r) => r.status !== 'paid' && r.status !== 'cancelled'),
    [rows],
  );

  const visible = useMemo(() => {
    const base = monthKey ? openRows.filter((r) => invoiceMonth(r) === monthKey) : openRows;
    return [...base].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  }, [openRows, monthKey]);

  const totals = useMemo(() => {
    const total = visible.reduce((s, r) => s + Number(r.amount), 0);
    const overdue = visible.filter((r) => r.status === 'overdue').reduce((s, r) => s + Number(r.amount), 0);
    return { total, overdue };
  }, [visible]);

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-ink">A receber</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Mensalidades e cobranças que ainda vão entrar no mês.</p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
          onClick={onNew}
        >
          <Plus size={14} /> Nova cobrança avulsa
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
          <span className="text-ink-muted">A receber:</span>
          <span className="font-semibold text-ink">{brl(totals.total)}</span>
          {totals.overdue > 0 && (
            <>
              <span className="mx-1 text-ink-subtle">•</span>
              <span className="text-ink-muted">Em atraso:</span>
              <span className="font-semibold text-danger">{brl(totals.overdue)}</span>
            </>
          )}
          <button
            type="button"
            className={`ml-2 rounded-lg border border-border px-2 py-0.5 text-[11px] font-semibold ${!monthKey ? 'bg-primary text-white border-primary' : 'bg-surface text-ink-muted hover:bg-canvas'}`}
            onClick={() => setMonthKey((k) => (k ? null : currentMonthKey()))}
            title="Alternar entre o mês e todas as cobranças"
          >
            {monthKey ? 'Todos' : 'Mês atual'}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={monthKey ? `Nenhuma cobrança em ${monthLabel(monthKey)}` : 'Nenhuma cobrança em aberto'}
          description={monthKey
            ? 'Use as setas para navegar entre os meses ou clique em "Todos" para ver o histórico.'
            : 'Não há mensalidades ou cobranças em aberto no momento.'}
        />
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                <th className="px-5 py-2.5">Aluno</th>
                <th className="hidden px-5 py-2.5 lg:table-cell">Responsável</th>
                <th className="hidden px-5 py-2.5 sm:table-cell">Ref.</th>
                <th className="px-5 py-2.5">Venc.</th>
                <th className="px-5 py-2.5 text-right">Valor</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 8).map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-canvas">
                  <td className="px-5 py-2.5 font-medium text-ink">{r.student_name}</td>
                  <td className="hidden px-5 py-2.5 text-ink-muted lg:table-cell">{r.guardian_name ?? '—'}</td>
                  <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{r.reference_month ?? '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{fmtDate(r.due_date)}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold text-ink">{brl(r.amount)}</td>
                  <td className="px-5 py-2.5"><StatusBadge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusBadge></td>
                  <td className="px-5 py-2.5 text-right">
                    {r.status !== 'paid' && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white disabled:opacity-50"
                        onClick={() => onSend?.(r.id)}
                        disabled={sendingId === r.id}
                        title="Gerar/reenviar o código PIX ao responsável"
                      >
                        {sendingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Enviar cobrança
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-border px-5 py-3">
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          onClick={onViewAll}
        >
          Ver todos a receber <ArrowRight size={13} />
        </button>
        <p className="mt-1.5 text-[11px] text-ink-subtle">
          Ao clicar em “Enviar cobrança”, o código PIX é gerado e fica disponível no portal do responsável.
        </p>
      </div>
    </div>
  );
}
