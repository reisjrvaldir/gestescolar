import { useEffect, useState } from 'react';
import { Loader2, Wallet, Copy, Check, QrCode, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { invoicesService, type MyInvoice, type InvoiceStatus } from '@/services/invoices';
import { brl } from '@/lib/fees';

const STATUS: Record<InvoiceStatus, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid: { tone: 'success', label: 'Pago' },
  pending: { tone: 'warning', label: 'Em aberto' },
  overdue: { tone: 'danger', label: 'Em atraso' },
  cancelled: { tone: 'danger', label: 'Cancelado' },
  refunded: { tone: 'warning', label: 'Estornado' },
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

export function FaturasPage() {
  const [invoices, setInvoices] = useState<MyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MyInvoice | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    invoicesService.mine().then(setInvoices).catch(console.error).finally(() => setLoading(false));
  }, []);

  function copyCode() {
    if (!selected?.pix_copy_paste) return;
    navigator.clipboard.writeText(selected.pix_copy_paste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  const open = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
  const paid = invoices.filter((i) => i.status === 'paid');

  return (
    <>
      <PageHeader title="Faturas" subtitle="Mensalidades e cobranças do(s) seu(s) filho(s)." />

      {invoices.length === 0 ? (
        <div className="card">
          <EmptyState icon={Wallet} title="Nenhuma fatura encontrada" description="As cobranças aparecerão aqui assim que forem geradas pela escola." />
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-border px-4 py-3 text-sm font-bold text-ink">Em aberto</div>
              <div className="divide-y divide-border">
                {open.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{inv.student_name}</p>
                      <p className="text-xs text-ink-muted">
                        {inv.kind === 'avulsa' ? 'Cobrança avulsa' : 'Mensalidade'}
                        {inv.reference_month ? ` — ${inv.reference_month}` : ''} · vence {fmtDate(inv.due_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</StatusBadge>
                      <span className="font-bold text-ink">{brl(inv.amount)}</span>
                      {(inv.pix_copy_paste || inv.checkout_url) && (
                        <button className="btn-outline text-xs" onClick={() => setSelected(inv)}>
                          <QrCode size={14} /> Pagar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paid.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-border px-4 py-3 text-sm font-bold text-ink">Pagas</div>
              <div className="divide-y divide-border">
                {paid.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium text-ink">{inv.student_name}</p>
                      <p className="text-xs text-ink-muted">
                        {inv.kind === 'avulsa' ? 'Cobrança avulsa' : 'Mensalidade'}
                        {inv.reference_month ? ` — ${inv.reference_month}` : ''}
                        {inv.paid_at ? ` · paga em ${fmtDate(inv.paid_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge tone="success">Pago</StatusBadge>
                      <span className="font-bold text-ink">{brl(inv.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={!!selected}
        title="Pagar fatura"
        onClose={() => setSelected(null)}
        footer={<button className="btn-primary" onClick={() => setSelected(null)}>Fechar</button>}
      >
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Aluno</span>
              <span className="font-medium text-ink">{selected.student_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Valor</span>
              <span className="text-lg font-extrabold text-ink">{brl(selected.amount)}</span>
            </div>
            {selected.pix_copy_paste && (
              <div className="rounded-xl border border-border bg-canvas p-3">
                <p className="mb-1 text-xs font-semibold text-ink-muted">Código PIX copia-e-cola</p>
                <p className="break-all font-mono text-xs text-ink">{selected.pix_copy_paste}</p>
                <button className="btn-outline mt-2 text-xs" onClick={copyCode}>
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado!' : 'Copiar código'}
                </button>
              </div>
            )}
            {selected.checkout_url && (
              <a href={selected.checkout_url} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center">
                <ExternalLink size={14} /> Pagar com cartão de crédito
              </a>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
