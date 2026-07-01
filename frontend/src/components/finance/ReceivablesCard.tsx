import { Plus, ArrowRight, Send } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { brl } from '@/lib/fees';
import type { Receivable, ReceivableStatus } from '@/data/finance/receivablesData';

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

const STATUS: Record<ReceivableStatus, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid: { tone: 'success', label: 'Pago' },
  open: { tone: 'warning', label: 'Aberto' },
  overdue: { tone: 'danger', label: 'Em atraso' },
};

interface Props {
  rows: Receivable[];
  onNew?: () => void;
  onSend?: (id: string) => void;
  onViewAll?: () => void;
}

/** Bloco de A receber (mensalidades a entrar) com envio de cobrança PIX. */
export function ReceivablesCard({ rows, onNew, onSend, onViewAll }: Props) {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-ink">A receber</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Valores das mensalidades que ainda vão entrar.</p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
          onClick={onNew}
        >
          <Plus size={14} /> Nova cobrança
        </button>
      </div>

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
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-canvas">
                <td className="px-5 py-2.5 font-medium text-ink">{r.studentName}</td>
                <td className="hidden px-5 py-2.5 text-ink-muted lg:table-cell">{r.guardianName}</td>
                <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{r.reference}</td>
                <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{fmtDate(r.dueDate)}</td>
                <td className="whitespace-nowrap px-5 py-2.5 text-right font-semibold text-ink">{brl(r.amount)}</td>
                <td className="px-5 py-2.5"><StatusBadge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusBadge></td>
                <td className="px-5 py-2.5 text-right">
                  <button
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white"
                    onClick={() => onSend?.(r.id)}
                    title="Enviar código PIX ao responsável"
                  >
                    <Send size={13} /> Enviar cobrança
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border px-5 py-3">
        <button className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline" onClick={onViewAll}>
          Ver todos a receber <ArrowRight size={13} />
        </button>
        <p className="mt-1.5 text-[11px] text-ink-subtle">
          Ao clicar em “Enviar cobrança”, o código PIX é enviado diretamente para o app do responsável.
        </p>
      </div>
    </div>
  );
}
