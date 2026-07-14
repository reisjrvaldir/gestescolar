import { useEffect, useState } from 'react';
import { Loader2, Wallet, Copy, Check, QrCode, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { QRCodeSVG } from 'qrcode.react';
import { invoicesService, type MyInvoice, type InvoiceStatus } from '@/services/invoices';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';

const STATUS: Record<InvoiceStatus, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid: { tone: 'success', label: 'Pago' },
  pending: { tone: 'warning', label: 'Em aberto' },
  overdue: { tone: 'danger', label: 'Em atraso' },
  cancelled: { tone: 'danger', label: 'Cancelado' },
  refunded: { tone: 'warning', label: 'Estornado' },
};

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

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const open = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
  const paid = invoices.filter((i) => i.status === 'paid');

  // Três grupos das cobranças em aberto.
  const mesAtual = open.filter((i) => i.kind !== 'avulsa' && (i.reference_month ?? '') <= currentMonth);
  const futuras = open.filter((i) => i.kind !== 'avulsa' && (i.reference_month ?? '') > currentMonth);
  const avulso = open.filter((i) => i.kind === 'avulsa');

  const total = (list: MyInvoice[]) => list.reduce((s, i) => s + i.amount, 0);

  const InvoiceRow = ({ inv, showPay }: { inv: MyInvoice; showPay: boolean }) => (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">
          {inv.kind === 'avulsa' ? (inv.charge_title ?? 'Cobrança avulsa') : inv.student_name}
        </p>
        <p className="text-xs text-ink-muted">
          {inv.kind === 'avulsa'
            ? (inv.charge_description ?? inv.student_name)
            : `Mensalidade${inv.reference_month ? ` — ${inv.reference_month}` : ''}`}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-subtle">
          {inv.status === 'paid'
            ? (inv.paid_at ? `Paga em ${fmtDate(inv.paid_at)}` : 'Paga')
            : `Vence ${fmtDate(inv.due_date)}`}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className="font-bold text-ink">{brl(inv.amount)}</span>
        <StatusBadge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</StatusBadge>
        {showPay && (inv.pix_copy_paste || inv.checkout_url) && (
          <button className="btn-outline text-xs" onClick={() => setSelected(inv)}>
            <QrCode size={14} /> Pagar
          </button>
        )}
      </div>
    </div>
  );

  const Column = ({ title, hint, list }: { title: string; hint: string; list: MyInvoice[] }) => (
    <div className="card flex flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink">{title}</span>
          <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-ink-muted">{list.length}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-subtle">{hint} · {brl(total(list))}</p>
      </div>
      {list.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-ink-subtle">Nada por aqui.</div>
      ) : (
        <div className="divide-y divide-border">
          {list.map((inv) => <InvoiceRow key={inv.id} inv={inv} showPay />)}
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHeader title="Faturas" subtitle="Mensalidades e cobranças do(s) seu(s) filho(s)." />

      {invoices.length === 0 ? (
        <div className="card">
          <EmptyState icon={Wallet} title="Nenhuma fatura encontrada" description="As cobranças aparecerão aqui assim que forem geradas pela escola." />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Column title="Mês atual" hint="A pagar agora" list={mesAtual} />
            <Column title="Futuras" hint="Próximos meses" list={futuras} />
            <Column title="Avulsas" hint="Cobranças extras" list={avulso} />
          </div>

          {paid.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-border px-4 py-3 text-sm font-bold text-ink">Pagas</div>
              <div className="divide-y divide-border">
                {paid.map((inv) => <InvoiceRow key={inv.id} inv={inv} showPay={false} />)}
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
            <div className="flex items-start justify-between gap-3">
              <span className="text-ink-muted">Referente a</span>
              <span className="text-right font-medium text-ink">
                {selected.kind === 'avulsa'
                  ? (selected.charge_title ?? 'Cobrança avulsa')
                  : `Mensalidade${selected.reference_month ? ` — ${selected.reference_month}` : ''}`}
                {selected.kind === 'avulsa' && selected.charge_description && (
                  <span className="block text-xs font-normal text-ink-muted">{selected.charge_description}</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Valor</span>
              <span className="text-lg font-extrabold text-ink">{brl(selected.amount)}</span>
            </div>
            {selected.pix_copy_paste && (
              <div className="flex flex-col items-center rounded-xl border border-border bg-white p-4">
                <p className="mb-2 text-xs font-semibold text-ink-muted">Aponte a câmera do seu banco</p>
                <QRCodeSVG value={selected.pix_copy_paste} size={192} level="M" marginSize={2} />
              </div>
            )}
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
