import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus, Loader2, Check, AlertTriangle, Copy, ChevronLeft, ChevronRight,
  Calendar, QrCode, Send, MessageSquare, Info, Wallet, Download,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { AdhocChargeModal } from '@/components/finance/AdhocChargeModal';
import { invoicesService, type Invoice } from '@/services/invoices';
import { calculatePixSplit, brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';
import { currentMonthKey, monthKeyOf, monthLabel, shiftMonth } from '@/lib/months';

const PAGE_SIZE = 50;

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS: Record<Invoice['status'], { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid:      { tone: 'success', label: 'Pago' },
  pending:   { tone: 'warning', label: 'Pendente' },
  overdue:   { tone: 'danger',  label: 'Vencido' },
  cancelled: { tone: 'danger',  label: 'Cancelado' },
  refunded:  { tone: 'warning', label: 'Estornado' },
};

export function ReceivablesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices]         = useState<Invoice[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<Invoice | null>(null);
  const [adhocOpen, setAdhocOpen]       = useState(false);
  const [sendingId, setSendingId]       = useState<string | null>(null);
  const [pixResult, setPixResult]       = useState<{ studentName: string; copyPaste?: string } | null>(null);
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [manualFor, setManualFor]       = useState<Invoice | null>(null);
  const [manualMethod, setManualMethod] = useState<'cash' | 'pix' | 'card' | 'other'>('cash');
  const [manualDate, setManualDate]     = useState(new Date().toISOString().slice(0, 10));
  const [manualSaving, setManualSaving] = useState(false);

  // --- URL-derived state ---
  const mesParam  = searchParams.get('mes');
  const monthKey: string | null = mesParam === 'todos' ? null : (mesParam ?? currentMonthKey());
  const page = Math.max(1, Number(searchParams.get('p') ?? '1'));

  // Initialize URL params on first render (replace so back button stays clean)
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (!next.has('mes')) { next.set('mes', currentMonthKey()); changed = true; }
    if (!next.has('p'))   { next.set('p',   '1');              changed = true; }
    if (changed) setSearchParams(next, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setInvoices(await invoicesService.list()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  function setMonth(mk: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('mes', mk ?? 'todos');
      next.set('p', '1'); // always reset to first page on filter change
      return next;
    });
  }

  function goToPage(p: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('p', String(p));
      return next;
    });
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  }

  const invoiceMonthKey = (r: Invoice): string | null =>
    r.reference_month ? String(r.reference_month).slice(0, 7) : monthKeyOf(r.due_date);

  // Filtered by month (full set — used for totals and export)
  const visibleInvoices = useMemo(() => {
    if (!monthKey) return invoices;
    return invoices.filter((r) => invoiceMonthKey(r) === monthKey);
  }, [invoices, monthKey]);

  // Pagination over the filtered set
  const totalFiltered = visibleInvoices.length;
  const totalPages    = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage      = Math.min(Math.max(1, page), totalPages);
  const pageItems     = visibleInvoices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Totals computed over the full filtered set (not just current page)
  const totals = useMemo(() => {
    const pending = visibleInvoices
      .filter((r) => r.status === 'pending' || r.status === 'overdue')
      .reduce((s, r) => s + Number(r.amount), 0);
    const paid = visibleInvoices
      .filter((r) => r.status === 'paid')
      .reduce((s, r) => s + Number(r.amount), 0);
    return { pending, paid, total: pending + paid };
  }, [visibleInvoices]);

  async function handleSendCharge(id: string) {
    setSendingId(id);
    try {
      await invoicesService.sendChargeToGuardian(id);
      const inv = invoices.find((i) => i.id === id);
      showToast('success', `Cobrança enviada para o chat do responsável de ${inv?.student_name ?? 'aluno'}.`);
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao enviar a cobrança.');
    } finally {
      setSendingId(null);
    }
  }

  async function handleShowQr(id: string) {
    setSendingId(id);
    try {
      const charge = await invoicesService.generatePix(id);
      const inv = invoices.find((i) => i.id === id);
      setPixResult({ studentName: inv?.student_name ?? '—', copyPaste: charge.pixCopyPaste });
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao gerar o QR Code.');
    } finally {
      setSendingId(null);
    }
  }

  function openManual(inv: Invoice) {
    setManualFor(inv);
    setManualMethod('cash');
    setManualDate(new Date().toISOString().slice(0, 10));
  }

  async function confirmManualPayment() {
    if (!manualFor) return;
    setManualSaving(true);
    try {
      await invoicesService.registerManualPayment(manualFor.id, { payment_method: manualMethod, paid_at: manualDate });
      showToast('success', `Pagamento de ${manualFor.student_name} registrado.`);
      setManualFor(null);
      setSelected(null);
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Falha ao registrar pagamento.');
    } finally {
      setManualSaving(false);
    }
  }

  // Export: always the complete filtered set, never just the current page
  function exportReceivables() {
    if (visibleInvoices.length === 0) { showToast('error', 'Nada a exportar.'); return; }
    downloadCsv(
      `a-receber-${monthKey ?? 'todos'}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Aluno', 'Matrícula', 'Responsável', 'Turma', 'Valor', 'Vencimento', 'Referência', 'Status'],
      visibleInvoices.map((i) => [
        i.student_name, i.registration_number ?? '', i.guardian_name ?? '', i.class_name ?? '',
        i.amount.toFixed(2), i.due_date ?? '', i.reference_month ?? '', STATUS[i.status].label,
      ]),
    );
    showToast('success', `Exportadas ${visibleInvoices.length} cobrança${visibleInvoices.length !== 1 ? 's' : ''}.`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-muted">
        <Loader2 className="animate-spin" size={24} />
        <span className="ml-2">Carregando…</span>
      </div>
    );
  }

  // Human-readable count for the footer
  const noun = (n: number) => `${n} cobrança${n !== 1 ? 's' : ''}`;
  const countLabel = monthKey
    ? `${noun(totalFiltered)} em ${monthLabel(monthKey)}`
    : `${noun(totalFiltered)} no total`;

  return (
    <>
      {/* ===== HERO ===== */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EDE9FE] via-[#F3EEFF] to-[#F5F3FF] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">A receber</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Acompanhe mensalidades, cobranças e valores previstos de entrada.
            </p>
            <button
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-purple/90"
              onClick={() => setAdhocOpen(true)}
            >
              <Plus size={18} /> Nova cobrança
            </button>
          </div>
          <div className="hidden shrink-0 items-center justify-center sm:flex">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-purple/10 text-purple shadow-inner">
              <Wallet size={64} />
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
          toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />} {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* ===== Coluna principal ===== */}
        <div className="min-w-0 space-y-4">

          {/* Navegador de mês */}
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="rounded-lg border border-border bg-surface p-1.5 text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
                  onClick={() => setMonth(shiftMonth(monthKey ?? currentMonthKey(), -1))}
                  disabled={!monthKey}
                  aria-label="Mês anterior"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <div className="flex min-w-[170px] items-center justify-center gap-1.5 rounded-lg bg-canvas px-3 py-1.5 text-sm font-semibold text-ink">
                  <Calendar size={14} className="text-ink-muted" aria-hidden="true" />
                  {monthKey
                    ? <span className="capitalize">{monthLabel(monthKey)}</span>
                    : <span>Todos os meses</span>
                  }
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-border bg-surface p-1.5 text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
                  onClick={() => setMonth(shiftMonth(monthKey ?? currentMonthKey(), 1))}
                  disabled={!monthKey}
                  aria-label="Próximo mês"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                {monthKey !== currentMonthKey() && (
                  <button
                    type="button"
                    className="ml-2 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-canvas"
                    onClick={() => setMonth(currentMonthKey())}
                  >
                    Mês atual
                  </button>
                )}
                <button
                  type="button"
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    !monthKey
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-surface text-ink-muted hover:bg-canvas'
                  }`}
                  onClick={() => setMonth(monthKey ? null : currentMonthKey())}
                  aria-pressed={!monthKey}
                >
                  {monthKey ? 'Todos' : 'Filtrar por mês'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
                  onClick={exportReceivables}
                >
                  <Download size={14} aria-hidden="true" /> Exportar
                </button>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="card overflow-hidden">
            {visibleInvoices.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-ink-muted">
                {invoices.length === 0
                  ? 'Não existe fatura cadastrada ainda.'
                  : monthKey
                    ? `Nenhuma cobrança em ${monthLabel(monthKey)}.`
                    : 'Nenhuma cobrança encontrada.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                      <th className="px-4 py-3">Aluno</th>
                      <th className="px-4 py-3">Responsável</th>
                      <th className="px-4 py-3">Referência</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((inv) => (
                      <tr
                        key={inv.id}
                        className={`cursor-pointer border-b border-border last:border-0 hover:bg-canvas ${selected?.id === inv.id ? 'bg-primary-soft/40' : ''}`}
                        onClick={() => setSelected(inv)}
                      >
                        <td className="px-4 py-3 font-medium text-ink">{inv.student_name}</td>
                        <td className="px-4 py-3 text-ink-muted">{inv.guardian_name ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{inv.reference_month ?? '—'}</td>
                        <td className="px-4 py-3 text-ink-muted">{fmtDate(inv.due_date)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-ink">{brl(inv.amount)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {inv.status === 'paid' ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-success-soft px-2.5 py-1.5 text-xs font-semibold text-success">
                              <Check size={13} aria-hidden="true" /> Pago
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-semibold text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50"
                                onClick={(e) => { e.stopPropagation(); handleShowQr(inv.id); }}
                                disabled={sendingId === inv.id}
                                aria-label={`QR Code PIX para ${inv.student_name}`}
                              >
                                {sendingId === inv.id
                                  ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                                  : <QrCode size={13} aria-hidden="true" />}
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg bg-success px-2 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
                                onClick={(e) => { e.stopPropagation(); openManual(inv); }}
                                aria-label={`Registrar pagamento de ${inv.student_name}`}
                              >
                                <Check size={13} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white disabled:opacity-50"
                                onClick={(e) => { e.stopPropagation(); handleSendCharge(inv.id); }}
                                disabled={sendingId === inv.id}
                                aria-label={`Enviar cobrança para responsável de ${inv.student_name}`}
                              >
                                {sendingId === inv.id
                                  ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                                  : <Send size={13} aria-hidden="true" />}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginação (só aparece quando há mais de uma página) */}
            {totalPages > 1 && (
              <nav aria-label="Paginação de cobranças" className="flex items-center justify-between border-t border-border px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => goToPage(safePage - 1)}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-canvas disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={13} aria-hidden="true" /> Anterior
                </button>
                <span className="text-xs text-ink-muted" aria-live="polite" aria-atomic="true">
                  Página <strong className="text-ink">{safePage}</strong> de <strong className="text-ink">{totalPages}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-canvas disabled:opacity-40"
                  aria-label="Próxima página"
                >
                  Próxima <ChevronRight size={13} aria-hidden="true" />
                </button>
              </nav>
            )}

            {/* Legenda e contagem */}
            {totalFiltered > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-3 text-[11px] text-ink-subtle">
                <span aria-live="polite" aria-atomic="true">
                  {countLabel}
                  {monthKey && invoices.length !== totalFiltered && (
                    <> · <span className="text-ink-subtle">{noun(invoices.length)} no total</span></>
                  )}
                </span>
                <span className="inline-flex items-center gap-1"><QrCode size={12} aria-hidden="true" /> <b>QR</b>: PIX</span>
                <span className="inline-flex items-center gap-1"><Check size={12} aria-hidden="true" /> <b>✓</b>: Pagamento manual</span>
                <span className="inline-flex items-center gap-1"><MessageSquare size={12} aria-hidden="true" /> <b>Enviar</b>: Chat do responsável</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== Sidebar ===== */}
        <div className="space-y-4">
          {/* Resumo do recebimento (reflete o conjunto filtrado completo) */}
          <div className="card p-5">
            <p className="mb-3 text-sm font-bold text-ink">
              {monthKey ? `Resumo — ${monthLabel(monthKey)}` : 'Resumo geral'}
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Total previsto</span>
                <span className="font-medium text-ink">{brl(totals.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Total recebido</span>
                <span className="font-semibold text-success">{brl(totals.paid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">A receber</span>
                <span className="font-semibold text-warning">{brl(totals.pending)}</span>
              </div>
              {totals.total > 0 && (
                <>
                  <div className="border-t border-border pt-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">% recebido</span>
                    <span className="font-bold text-primary">
                      {(totals.paid / totals.total * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuenow={Math.round(totals.paid / totals.total * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, totals.paid / totals.total * 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Detalhe do split PIX */}
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
              <Info size={16} className="text-primary" aria-hidden="true" /> Detalhe do split (PIX)
            </div>
            {!selected ? (
              <p className="text-sm text-ink-muted">Selecione uma fatura para ver o split.</p>
            ) : (
              <>
                <SplitDetail invoice={selected} />
                {selected.status !== 'paid' && selected.status !== 'cancelled' && (
                  <button
                    className="btn-outline mt-4 flex w-full items-center justify-center gap-1.5 text-xs"
                    onClick={() => openManual(selected)}
                  >
                    <Check size={14} aria-hidden="true" /> Registrar pagamento recebido
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal: registrar pagamento offline */}
      <Modal
        open={!!manualFor}
        onClose={() => !manualSaving && setManualFor(null)}
        title="Registrar pagamento recebido"
        footer={
          <>
            <button className="btn-outline" onClick={() => setManualFor(null)} disabled={manualSaving}>
              Cancelar
            </button>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={confirmManualPayment}
              disabled={manualSaving}
            >
              {manualSaving
                ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                : <Check size={16} aria-hidden="true" />}
              {manualSaving ? 'Registrando…' : 'Confirmar pagamento'}
            </button>
          </>
        }
      >
        {manualFor && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-canvas p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Aluno</span>
                <span className="font-medium text-ink">{manualFor.student_name}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-ink-muted">Valor</span>
                <span className="font-bold text-ink">{brl(manualFor.amount)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Forma recebida</label>
                <select
                  className="input"
                  value={manualMethod}
                  onChange={(e) => setManualMethod(e.target.value as typeof manualMethod)}
                >
                  <option value="cash">Dinheiro</option>
                  <option value="pix">PIX (fora do sistema)</option>
                  <option value="card">Cartão (maquininha)</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div>
                <label className="label">Data do pagamento</label>
                <input
                  type="date"
                  className="input"
                  value={manualDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Baixa manual: a fatura será marcada como <strong>paga</strong>.
                Este valor <strong>não entra no saldo sacável</strong>.
              </span>
            </div>
          </div>
        )}
      </Modal>

      <AdhocChargeModal
        open={adhocOpen}
        onClose={() => setAdhocOpen(false)}
        onCreated={(result) => {
          showToast('success', `Cobrança criada para ${result.invoicesCreated} aluno(s).`);
          load();
        }}
        onError={(msg) => showToast('error', msg)}
      />

      {/* Modal: QR Code PIX */}
      <Modal
        open={!!pixResult}
        title="Cobrança PIX gerada"
        onClose={() => setPixResult(null)}
        footer={<button className="btn-primary" onClick={() => setPixResult(null)}>Fechar</button>}
      >
        {pixResult && (
          <div className="space-y-3 text-sm">
            <p className="text-ink-muted">Aluno: <strong className="text-ink">{pixResult.studentName}</strong></p>
            {pixResult.copyPaste && (
              <div className="flex flex-col items-center rounded-xl border border-border bg-white p-4">
                <p className="mb-2 text-xs font-semibold text-ink-muted">Aponte a câmera do banco para pagar</p>
                <QRCodeSVG value={pixResult.copyPaste} size={192} level="M" marginSize={2} />
              </div>
            )}
            {pixResult.copyPaste ? (
              <div className="rounded-xl border border-border bg-canvas p-3">
                <p className="mb-1 text-xs font-semibold text-ink-muted">Código PIX copia-e-cola</p>
                <p className="break-all font-mono text-xs text-ink">{pixResult.copyPaste}</p>
                <button
                  className="btn-outline mt-2 text-xs"
                  onClick={() => navigator.clipboard.writeText(pixResult.copyPaste ?? '')}
                >
                  <Copy size={13} aria-hidden="true" /> Copiar código
                </button>
              </div>
            ) : (
              <p className="text-xs text-ink-subtle">O código já está disponível no portal do responsável.</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function SplitDetail({ invoice }: { invoice: Invoice }) {
  const s = calculatePixSplit(invoice.amount);
  const Row = ({ label, value, strong, tone }: {
    label: string; value: string; strong?: boolean; tone?: string;
  }) => (
    <div className={`flex items-center justify-between py-2 text-sm ${strong ? 'font-bold' : ''}`}>
      <span className={strong ? 'text-ink' : 'text-ink-muted'}>{label}</span>
      <span className={tone ?? 'text-ink'}>{value}</span>
    </div>
  );
  return (
    <div>
      <p className="mb-2 text-xs text-ink-subtle">{invoice.student_name}</p>
      <Row label="Valor bruto" value={brl(s.grossAmount)} />
      <div className="border-t border-border" />
      <Row label="Taxa plataforma (5%)" value={`– ${brl(s.platformFeeAmount)}`} tone="text-warning" />
      <div className="border-t border-border" />
      <Row label="Líquido da escola" value={brl(s.schoolNetAmount)} strong tone="text-success" />
    </div>
  );
}
