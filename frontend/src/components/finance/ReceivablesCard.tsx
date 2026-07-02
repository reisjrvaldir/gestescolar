import { Plus, ArrowRight, Send, Loader2, Wallet } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';
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

/** Bloco de A receber (mensalidades e cobranças a entrar) com envio de cobrança PIX real. */
export function ReceivablesCard({ rows, onNew, onSend, onViewAll, sendingId }: Props) {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-ink">A receber</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Valores das mensalidades e cobranças que ainda vão entrar.</p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
          onClick={onNew}
        >
          <Plus size={14} /> Nova cobrança avulsa
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Wallet} title="Nenhuma cobrança em aberto" description="As mensalidades geradas para os alunos aparecerão aqui." />
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
              {rows.slice(0, 8).map((r) => (
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
        <button className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline" onClick={onViewAll}>
          Ver todos a receber <ArrowRight size={13} />
        </button>
        <p className="mt-1.5 text-[11px] text-ink-subtle">
          Ao clicar em “Enviar cobrança”, o código PIX é gerado e fica disponível no portal do responsável.
        </p>
      </div>
    </div>
  );
}
