import { useEffect, useState, useMemo } from 'react';
import {
  Loader2, Wallet, Copy, Check, QrCode, ExternalLink,
  Eye, EyeOff, Download, FileText, CreditCard,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { QRCodeSVG } from 'qrcode.react';
import { invoicesService, type MyInvoice, type InvoiceStatus } from '@/services/invoices';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';
import { useMe } from '@/auth/AuthGate';
import { api } from '@/lib/api';

const STATUS: Record<InvoiceStatus, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid: { tone: 'success', label: 'Pago' },
  pending: { tone: 'warning', label: 'Pendente' },
  overdue: { tone: 'danger', label: 'Atrasado' },
  cancelled: { tone: 'danger', label: 'Cancelado' },
  refunded: { tone: 'warning', label: 'Estornado' },
};

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

interface ChildStat {
  id: string;
  name: string;
  registration_number: string;
  monthly_fee: number;
  photo_url?: string;
  class_name?: string;
  class_year?: number;
}

function generateIRPdf(me: any, invoices: MyInvoice[], year: number) {
  const paid = invoices.filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at).getFullYear() === year);
  const total = paid.reduce((s, i) => s + i.amount, 0);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprovante IR ${year}</title>
    <style>body{font-family:Arial,sans-serif;margin:40px;color:#333}
    .header{text-align:center;margin-bottom:30px;border-bottom:2px solid #1a1a1a;padding-bottom:15px}
    .header h1{font-size:18px;margin:0}
    .header p{font-size:12px;color:#666;margin:4px 0}
    table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}
    th{background:#f5f5f5;font-weight:bold}
    .total{font-weight:bold;font-size:15px;margin-top:20px}
    @media print{body{margin:20px}}
    </style></head><body>
    <div class="header">
      <h1>${me?.school_name ?? 'Escola'}</h1>
      <p>Comprovante de Pagamentos para Imposto de Renda — Ano ${year}</p>
    </div>
    <p><strong>Responsável:</strong> ${me?.name ?? ''}</p>
    <table>
      <thead><tr><th>Ref.</th><th>Aluno</th><th>Data Pgto.</th><th>Valor</th></tr></thead>
      <tbody>
      ${paid.map(i => `<tr>
        <td>${i.kind === 'avulsa' ? (i.charge_title ?? 'Avulsa') : i.kind === 'matricula' ? 'Matrícula' : `Mensalidade ${i.reference_month ?? ''}`}</td>
        <td>${i.student_name}</td>
        <td>${i.paid_at ? new Date(i.paid_at).toLocaleDateString('pt-BR') : '—'}</td>
        <td>R$ ${i.amount.toFixed(2)}</td>
      </tr>`).join('')}
      </tbody>
    </table>
    <p class="total">Total pago em ${year}: R$ ${total.toFixed(2)}</p>
    </body></html>`);
  w.document.close();
  w.print();
}

export function FaturasPage() {
  const me = useMe();
  const [invoices, setInvoices] = useState<MyInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MyInvoice | null>(null);
  const [copied, setCopied] = useState(false);
  const [childStats, setChildStats] = useState<ChildStat | null>(null);
  const [hiddenPayments, setHiddenPayments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      try {
        const [inv, dash] = await Promise.all([
          invoicesService.mine(),
          api.get<{ ok: boolean; data: any }>('/dashboard/stats'),
        ]);
        setInvoices(inv);
        if (dash.data.children?.length > 0) setChildStats(dash.data.children[0]);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  function copyCode() {
    if (!selected?.pix_copy_paste) return;
    navigator.clipboard.writeText(selected.pix_copy_paste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const openInvoices = useMemo(() => invoices.filter(i => i.status === 'pending' || i.status === 'overdue'), [invoices]);
  const paidInvoices = useMemo(() => invoices.filter(i => i.status === 'paid'), [invoices]);
  const overdueInvoices = useMemo(() => invoices.filter(i => i.status === 'overdue'), [invoices]);
  const currentMonthPending = useMemo(() => openInvoices.filter(i => i.status === 'pending' && (i.reference_month ?? '') <= currentMonth), [openInvoices, currentMonth]);

  const totalMes = useMemo(() => {
    const mensalidade = invoices.filter(i => i.kind !== 'avulsa' && (i.reference_month ?? '') === currentMonth);
    const avulsas = invoices.filter(i => i.kind === 'avulsa' && i.status !== 'cancelled');
    return [...mensalidade, ...avulsas].reduce((s, i) => s + i.amount, 0);
  }, [invoices, currentMonth]);

  const paidTotal = useMemo(() => paidInvoices.reduce((s, i) => s + i.amount, 0), [paidInvoices]);

  // Próximas a pagar = mensalidades/matrícula em aberto (avulsas têm seção própria).
  const proximasAPagar = useMemo(
    () => openInvoices.filter((i) => i.kind !== 'avulsa').sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')),
    [openInvoices],
  );
  // Faturas avulsas (todas — pagas e em aberto), sempre com seção visível.
  const avulsas = useMemo(
    () => invoices.filter((i) => i.kind === 'avulsa').sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? '')),
    [invoices],
  );

  function generatePaymentPdf(inv: MyInvoice) {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprovante de Pagamento</title>
      <style>body{font-family:Arial,sans-serif;margin:40px;color:#333}
      .header{text-align:center;margin-bottom:30px;border-bottom:2px solid #1a1a1a;padding-bottom:15px}
      .header h1{font-size:18px;margin:0}
      .header p{font-size:12px;color:#666;margin:4px 0}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}
      .row span:first-child{color:#666}
      .row span:last-child{font-weight:bold}
      @media print{body{margin:20px}}
      </style></head><body>
      <div class="header">
        <h1>${me?.school_name ?? 'Escola'}</h1>
        <p>Comprovante de Pagamento</p>
      </div>
      <div class="row"><span>Aluno</span><span>${inv.student_name}</span></div>
      <div class="row"><span>Referente a</span><span>${inv.kind === 'avulsa' ? (inv.charge_title ?? 'Avulsa') : inv.kind === 'matricula' ? 'Matrícula' : `Mensalidade ${inv.reference_month ?? ''}`}</span></div>
      <div class="row"><span>Valor</span><span>R$ ${inv.amount.toFixed(2)}</span></div>
      <div class="row"><span>Data de pagamento</span><span>${inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('pt-BR') : '—'}</span></div>
      <div class="row"><span>Forma de pagamento</span><span>${inv.payment_method === 'card' ? 'Cartão de crédito' : inv.payment_method === 'pix' ? 'PIX' : 'Na escola'}</span></div>
      <div class="row"><span>Status</span><span style="color:#22c55e">Pago</span></div>
      </body></html>`);
    w.document.close();
    w.print();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Faturas"
        subtitle="Mensalidades e cobranças do(s) seu(s) filho(s)."
        actions={
          <button className="btn-outline text-xs" onClick={() => generateIRPdf(me, invoices, new Date().getFullYear() - 1)}>
            <FileText size={14} /> Comprovante IR {new Date().getFullYear() - 1}
          </button>
        }
      />

      {invoices.length === 0 ? (
        <div className="card">
          <EmptyState icon={Wallet} title="Nenhuma fatura encontrada" description="As cobranças aparecerão aqui assim que forem geradas pela escola." />
        </div>
      ) : (
        /* Layout 70/30 desde o topo */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
          {/* Left 70% */}
          <div className="space-y-6">
            {/* Student header dentro do 70% */}
            {childStats && (
              <div className="card p-5">
                <div className="flex items-center gap-4">
                  {childStats.photo_url ? (
                    <img src={childStats.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-xl font-bold text-primary">
                      {initials(childStats.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-extrabold text-ink">{childStats.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                      <span>Matrícula: <span className="font-mono font-semibold">{childStats.registration_number}</span></span>
                      {childStats.class_name && <span>Turma: <strong>{childStats.class_name}</strong></span>}
                      {childStats.class_year && <span>Ano letivo: <strong>{childStats.class_year}</strong></span>}
                      <span>Mensalidade: <strong className="text-ink">{brl(Number(childStats.monthly_fee) || 0)}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4 Cards alinhados ao 70% */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <div className="card p-4">
                <p className="text-xs font-medium text-ink-muted">Em aberto</p>
                <p className="mt-1 text-xl font-extrabold text-warning">{brl(currentMonthPending.reduce((s, i) => s + i.amount, 0))}</p>
                <p className="mt-0.5 text-[11px] text-ink-subtle">{currentMonthPending.length} fatura(s)</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-medium text-ink-muted">Pagas</p>
                <p className="mt-1 text-xl font-extrabold text-success">{brl(paidTotal)}</p>
                <p className="mt-0.5 text-[11px] text-ink-subtle">{paidInvoices.length} fatura(s)</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-medium text-ink-muted">Vencidas</p>
                <p className="mt-1 text-xl font-extrabold text-danger">{brl(overdueInvoices.reduce((s, i) => s + i.amount, 0))}</p>
                <p className="mt-0.5 text-[11px] text-ink-subtle">{overdueInvoices.length} fatura(s)</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-medium text-ink-muted">Total do mês</p>
                <p className="mt-1 text-xl font-extrabold text-ink">{brl(totalMes)}</p>
                <p className="mt-0.5 text-[11px] text-ink-subtle">Mensalidade + avulsas</p>
              </div>
            </div>

            {/* Próximas a pagar */}
            <div className="card overflow-hidden">
              <div className="border-b border-border px-5 py-3.5">
                <h3 className="text-sm font-bold text-ink">Mensalidades a pagar</h3>
              </div>
              {proximasAPagar.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhuma mensalidade pendente.</p>
              ) : (
                <div className="divide-y divide-border">
                  {proximasAPagar.map((inv) => (
                    <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">
                          {inv.kind === 'avulsa' ? (inv.charge_title ?? 'Cobrança avulsa') : inv.student_name}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {inv.kind === 'avulsa' ? 'Avulsa' : inv.kind === 'matricula' ? 'Matrícula' : 'Mensalidade'}
                          {inv.reference_month && ` — ${inv.reference_month}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-ink">{brl(inv.amount)}</p>
                          <p className="text-[11px] text-ink-muted">Vence {fmtDate(inv.due_date)}</p>
                        </div>
                        <StatusBadge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</StatusBadge>
                        {(inv.pix_copy_paste || inv.checkout_url) && (
                          <button className="btn-primary text-xs" onClick={() => setSelected(inv)}>
                            <CreditCard size={13} /> Pagar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Faturas avulsas — sempre visível (mesmo sem cobrança) */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <h3 className="text-sm font-bold text-ink">Faturas avulsas</h3>
                <span className="text-[11px] text-ink-subtle">Materiais, passeios, taxas extras</span>
              </div>
              {avulsas.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <FileText size={24} className="mx-auto mb-2 text-ink-subtle" />
                  <p className="text-sm text-ink-subtle">Nenhuma cobrança avulsa no momento.</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">Cobranças extras lançadas pela escola aparecerão aqui.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {avulsas.map((inv) => {
                    const isPaid = inv.status === 'paid';
                    return (
                      <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink">{inv.charge_title ?? 'Cobrança avulsa'}</p>
                          <p className="text-xs text-ink-muted">
                            {inv.student_name}
                            {inv.due_date && ` · Vence ${fmtDate(inv.due_date)}`}
                            {isPaid && inv.paid_at && ` · Pago em ${fmtDate(inv.paid_at)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-ink">{brl(inv.amount)}</span>
                          <StatusBadge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</StatusBadge>
                          {!isPaid && (inv.pix_copy_paste || inv.checkout_url) && (
                            <button className="btn-primary text-xs" onClick={() => setSelected(inv)}>
                              <CreditCard size={13} /> Pagar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Histórico de faturas */}
            <div className="card overflow-hidden">
              <div className="border-b border-border px-5 py-3.5">
                <h3 className="text-sm font-bold text-ink">Histórico de faturas</h3>
              </div>
              <div className="divide-y divide-border">
                {invoices
                  .sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''))
                  .map((inv) => {
                    const isPaid = inv.status === 'paid';
                    const hidden = hiddenPayments[inv.id];
                    const paymentLabel = inv.payment_method === 'card' ? 'Cartão' : inv.payment_method === 'pix' ? 'PIX' : 'Na escola';
                    return (
                      <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink">
                            {inv.kind === 'avulsa' ? (inv.charge_title ?? 'Cobrança avulsa') : inv.student_name}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {inv.kind === 'avulsa' ? 'Avulsa' : inv.kind === 'matricula' ? 'Matrícula' : 'Mensalidade'}
                            {inv.reference_month && ` — ${inv.reference_month}`}
                            {isPaid && inv.paid_at && ` · Pago em ${fmtDate(inv.paid_at)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">{brl(inv.amount)}</span>
                          <StatusBadge tone={STATUS[inv.status].tone}>
                            {isPaid ? (hidden ? 'Pago' : `Pago — ${paymentLabel}`) : STATUS[inv.status].label}
                          </StatusBadge>
                          {isPaid && (
                            <>
                              <button
                                className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
                                onClick={() => setHiddenPayments(h => ({ ...h, [inv.id]: !h[inv.id] }))}
                                title={hidden ? 'Mostrar forma de pagamento' : 'Ocultar forma de pagamento'}
                              >
                                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button
                                className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
                                onClick={() => generatePaymentPdf(inv)}
                                title="Baixar comprovante"
                              >
                                <Download size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Right 30% — PIX panel desde o topo */}
          <div>
            {selected ? (
              <div className="card sticky top-4 p-5">
                <h3 className="mb-4 text-sm font-bold text-ink">Detalhes da fatura</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Referente</span>
                    <span className="font-medium text-ink">
                      {selected.kind === 'avulsa'
                        ? (selected.charge_title ?? 'Cobrança avulsa')
                        : selected.kind === 'matricula'
                          ? 'Matrícula'
                          : `Mensalidade${selected.reference_month ? ` ${selected.reference_month}` : ''}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Vencimento</span>
                    <span className="font-medium text-ink">{fmtDate(selected.due_date)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Valor</span>
                    <span className="text-lg font-extrabold text-ink">{brl(selected.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Aluno</span>
                    <span className="font-medium text-ink">{selected.student_name}</span>
                  </div>
                  {selected.charge_description && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-ink-muted">Descrição</span>
                      <span className="text-right text-xs text-ink">{selected.charge_description}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Emitida em</span>
                    <span className="font-medium text-ink">{fmtDate(selected.created_at)}</span>
                  </div>

                  {selected.pix_copy_paste && (
                    <>
                      <div className="flex flex-col items-center rounded-xl border border-border bg-white p-4">
                        <p className="mb-2 text-xs font-semibold text-ink-muted">Aponte a câmera do seu banco</p>
                        <QRCodeSVG value={selected.pix_copy_paste} size={160} level="M" marginSize={2} />
                      </div>
                      <div className="rounded-xl border border-border bg-canvas p-3">
                        <p className="mb-1 text-xs font-semibold text-ink-muted">PIX copia e cola</p>
                        <p className="break-all font-mono text-[11px] text-ink">{selected.pix_copy_paste}</p>
                        <button className="btn-outline mt-2 w-full justify-center text-xs" onClick={copyCode}>
                          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado!' : 'Copiar código'}
                        </button>
                      </div>
                    </>
                  )}
                  {selected.checkout_url && (
                    <a href={selected.checkout_url} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center">
                      <ExternalLink size={14} /> Pagar com cartão
                    </a>
                  )}
                </div>
                <button className="btn-outline mt-4 w-full justify-center text-xs" onClick={() => setSelected(null)}>
                  Fechar
                </button>
              </div>
            ) : (
              <div className="card sticky top-4 p-8 text-center text-ink-subtle">
                <QrCode size={32} className="mx-auto mb-2 text-ink-subtle" />
                <p className="text-sm">Clique em <strong>Pagar</strong> em uma fatura para ver os detalhes e o QR Code PIX.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
