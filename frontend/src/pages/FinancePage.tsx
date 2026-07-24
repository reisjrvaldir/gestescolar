import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Loader2, Info, Check, AlertTriangle, Copy, ChevronLeft, ChevronRight, Calendar, QrCode, Send, MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { FinanceSummaryCards } from '@/components/finance/FinanceSummaryCards';
import { RevenueExpenseChart } from '@/components/finance/RevenueExpenseChart';
import { ExpensesByCategoryChart } from '@/components/finance/ExpensesByCategoryChart';
import { PayablesCard } from '@/components/finance/PayablesCard';
import { ReceivablesCard } from '@/components/finance/ReceivablesCard';
import { DelinquencyCard } from '@/components/finance/DelinquencyCard';
import { QuickActionsGrid } from '@/components/finance/QuickActionsGrid';
import { AdhocChargeModal } from '@/components/finance/AdhocChargeModal';
import { PeriodPicker } from '@/components/finance/PeriodPicker';
import { todayRange, type Range as PeriodRange } from '@/lib/period';
import { quickActionsData } from '@/data/finance/quickActionsData';
import { invoicesService, type Invoice } from '@/services/invoices';
import { expensesService, type Expense } from '@/services/expenses';
import { financeService, type FinanceSummary, type MonthlyBalancePoint, type DelinquentInvoice } from '@/services/finance';
import { calculatePixSplit, brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';
import { currentMonthKey, monthKeyOf, monthLabel, shiftMonth } from '@/lib/months';

const TABS = [
  { key: 'visao', label: 'Visão geral' },
  { key: 'pagar', label: 'Contas a pagar' },
  { key: 'receber', label: 'A receber' },
  { key: 'inadimplencia', label: 'Inadimplência' },
];

/** Exporta linhas para CSV (client-side, sem backend) e dispara o download. */
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
  paid: { tone: 'success', label: 'Pago' },
  pending: { tone: 'warning', label: 'Pendente' },
  overdue: { tone: 'danger', label: 'Vencido' },
  cancelled: { tone: 'danger', label: 'Cancelado' },
  refunded: { tone: 'warning', label: 'Estornado' },
};

export function FinancePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('visao');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyBalancePoint[]>([]);
  const [delinquency, setDelinquency] = useState<DelinquentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [pixResult, setPixResult] = useState<{ studentName: string; copyPaste?: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [manualFor, setManualFor] = useState<Invoice | null>(null);
  const [manualMethod, setManualMethod] = useState<'cash' | 'pix' | 'card' | 'other'>('cash');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualSaving, setManualSaving] = useState(false);
  /** Filtro de mês da aba "A receber". null = todos os meses. Padrão = mês atual. */
  const [receberMonthKey, setReceberMonthKey] = useState<string | null>(currentMonthKey());
  /** Período da Visão geral (mês por padrão; usuário pode trocar para trim/sem/ano). */
  const [visaoRange, setVisaoRange] = useState<PeriodRange>(() => todayRange('month'));

  /** Mês de referência da fatura: usa reference_month; senão o mês do vencimento. */
  const invoiceMonthKey = (r: Invoice): string | null =>
    r.reference_month ? String(r.reference_month).slice(0, 7) : monthKeyOf(r.due_date);

  const visibleInvoices = useMemo(() => {
    if (!receberMonthKey) return invoices;
    return invoices.filter((r) => invoiceMonthKey(r) === receberMonthKey);
  }, [invoices, receberMonthKey]);

  const receberTotals = useMemo(() => {
    const pending = visibleInvoices
      .filter((r) => r.status === 'pending' || r.status === 'overdue')
      .reduce((s, r) => s + Number(r.amount), 0);
    const paid = visibleInvoices
      .filter((r) => r.status === 'paid')
      .reduce((s, r) => s + Number(r.amount), 0);
    return { pending, paid };
  }, [visibleInvoices]);

  useEffect(() => { load(); }, []);

  // Recarrega apenas o summary quando o período da Visão geral muda.
  useEffect(() => {
    let cancel = false;
    financeService
      .summary({ from: visaoRange.from, to: visaoRange.to })
      .then((s) => { if (!cancel) setSummary(s); })
      .catch((e) => console.error(e));
    return () => { cancel = true; };
  }, [visaoRange.from, visaoRange.to]);

  async function load() {
    setLoading(true);
    try {
      const [inv, exp, summ, mon, delq] = await Promise.all([
        invoicesService.list(),
        expensesService.list(),
        financeService.summary({ from: visaoRange.from, to: visaoRange.to }),
        financeService.monthly(),
        financeService.delinquency(),
      ]);
      setInvoices(inv);
      setExpenses(exp);
      setSummary(summ);
      setMonthly(mon);
      setDelinquency(delq);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  }

  // Envia o código PIX (copia-e-cola) para o chat do responsável.
  // O backend gera o PIX quando ainda não existe; requer conta ASAAS habilitada.
  async function handleSendCharge(id: string) {
    setSendingId(id);
    try {
      await invoicesService.sendChargeToGuardian(id);
      const inv = invoices.find((i) => i.id === id);
      showToast('success', `Cobrança enviada para o chat do responsável de ${inv?.student_name ?? 'aluno'}.`);
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao enviar a cobrança para o responsável.');
    } finally {
      setSendingId(null);
    }
  }

  // Gera/atualiza o PIX da fatura e abre o modal com QR + copia-e-cola,
  // para casos em que o gestor precisa mostrar o código na tela (caixa).
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

  function handleAdhocCreated(result: { studentsCount: number; invoicesCreated: number }) {
    showToast('success', `Cobrança avulsa criada para ${result.invoicesCreated} aluno(s).`);
    load();
  }

  function handleQuickAction(key: string) {
    switch (key) {
      case 'nova-despesa':
      case 'importar-despesas':
        navigate('/app/finance/expenses');
        break;
      case 'nova-cobranca':
      case 'gerar-pix':
        setAdhocOpen(true);
        break;
      case 'ver-inadimplentes':
        setTab('inadimplencia');
        break;
      case 'cobranca-lote':
        setAdhocOpen(true);
        break;
      case 'registrar-pagamento':
        setTab('receber');
        showToast('success', 'Selecione a fatura em "A receber" e clique em "Registrar pagamento recebido".');
        break;
      case 'exportar-relatorio':
        exportReceivables();
        break;
      default:
        showToast('error', 'Ação em breve.');
    }
  }

  const goExpenses = () => navigate('/app/finance/expenses');

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

  function exportReceivables() {
    if (invoices.length === 0) { showToast('error', 'Nada a exportar ainda.'); return; }
    downloadCsv(
      `a-receber-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Aluno', 'Matrícula', 'Responsável', 'Turma', 'Valor', 'Vencimento', 'Referência', 'Status'],
      invoices.map((i) => [
        i.student_name, i.registration_number ?? '', i.guardian_name ?? '', i.class_name ?? '',
        i.amount.toFixed(2), i.due_date ?? '', i.reference_month ?? '', STATUS[i.status].label,
      ]),
    );
    showToast('success', `Exportadas ${invoices.length} cobranças.`);
  }

  function exportDelinquency() {
    if (delinquency.length === 0) { showToast('error', 'Nenhum inadimplente para exportar.'); return; }
    downloadCsv(
      `inadimplentes-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Aluno', 'Responsável', 'Plano', 'Valor', 'Vencimento', 'Dias em atraso'],
      delinquency.map((d) => [
        d.student_name, d.guardian_name ?? '', d.plan_name ?? '',
        d.amount.toFixed(2), d.due_date ?? '', d.days_late,
      ]),
    );
    showToast('success', `Exportados ${delinquency.length} inadimplentes.`);
  }

  if (loading || !summary) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Gerencie receitas, despesas, contas a pagar, a receber e inadimplência da sua escola."
        actions={
          <button className="btn-primary" onClick={() => setAdhocOpen(true)}>
            <Plus size={16} /> Nova cobrança avulsa
          </button>
        }
      />

      <FinanceTabs tabs={TABS} active={tab} onChange={setTab} />

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
          toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />} {toast.msg}
        </div>
      )}

      {/* ===================== VISÃO GERAL ===================== */}
      {tab === 'visao' && (
        <div className="space-y-6">
          <PeriodPicker value={visaoRange} onChange={setVisaoRange} />
          <FinanceSummaryCards summary={summary} periodLabel={visaoRange.label} periodKind={visaoRange.period} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RevenueExpenseChart data={monthly} />
            <ExpensesByCategoryChart data={summary.expenses_by_category} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <PayablesCard rows={expenses} onNew={goExpenses} onViewAll={goExpenses} />
            <ReceivablesCard
              rows={invoices}
              onNew={() => setAdhocOpen(true)}
              onSend={handleSendCharge}
              onViewAll={() => setTab('receber')}
              sendingId={sendingId}
            />
          </div>

          <DelinquencyCard rows={delinquency} onViewAll={() => setTab('inadimplencia')} />

          <QuickActionsGrid actions={quickActionsData} onAction={handleQuickAction} />
        </div>
      )}

      {/* ===================== CONTAS A PAGAR ===================== */}
      {tab === 'pagar' && (
        <div className="space-y-4">
          <PayablesCard rows={expenses} onNew={goExpenses} onViewAll={goExpenses} />
          <p className="text-xs text-ink-subtle">
            As despesas cadastradas alimentam automaticamente o card “Despesas do mês” da visão geral.
            A gestão completa de despesas fica em <button className="font-semibold text-primary hover:underline" onClick={goExpenses}>Contas a Pagar</button>.
          </p>
        </div>
      )}

      {/* ===================== A RECEBER (dados reais) ===================== */}
      {tab === 'receber' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card overflow-hidden lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-ink">A receber</h3>
                <p className="mt-0.5 text-xs text-ink-muted">Mensalidades e cobranças avulsas dos alunos. As mensalidades começam no mês seguinte à matrícula — meses anteriores não geram fatura.</p>
              </div>
              <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas" onClick={() => setAdhocOpen(true)}>
                <Plus size={14} /> Nova cobrança avulsa
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-canvas/40 px-5 py-2.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="rounded-lg border border-border bg-surface p-1 text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
                  onClick={() => setReceberMonthKey((k) => shiftMonth(k ?? currentMonthKey(), -1))}
                  disabled={!receberMonthKey}
                  title="Mês anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="flex min-w-[170px] items-center justify-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
                  <Calendar size={12} className="text-ink-muted" />
                  {receberMonthKey
                    ? <span className="capitalize">{monthLabel(receberMonthKey)}</span>
                    : <span>Todos os meses</span>}
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-border bg-surface p-1 text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-40"
                  onClick={() => setReceberMonthKey((k) => shiftMonth(k ?? currentMonthKey(), 1))}
                  disabled={!receberMonthKey}
                  title="Próximo mês"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-muted">Pendente:</span>
                <span className="font-semibold text-warning">{brl(receberTotals.pending)}</span>
                <span className="mx-1 text-ink-subtle">•</span>
                <span className="text-ink-muted">Recebido:</span>
                <span className="font-semibold text-success">{brl(receberTotals.paid)}</span>
                {receberMonthKey !== currentMonthKey() && (
                  <button
                    type="button"
                    className="ml-2 rounded-lg border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-muted hover:bg-canvas"
                    onClick={() => setReceberMonthKey(currentMonthKey())}
                  >
                    Mês atual
                  </button>
                )}
                <button
                  type="button"
                  className={`rounded-lg border border-border px-2 py-0.5 text-[11px] font-semibold ${!receberMonthKey ? 'bg-primary text-white border-primary' : 'bg-surface text-ink-muted hover:bg-canvas'}`}
                  onClick={() => setReceberMonthKey((k) => (k ? null : currentMonthKey()))}
                  title="Alternar entre o mês e todas as cobranças"
                >
                  {receberMonthKey ? 'Todos' : 'Filtrar por mês'}
                </button>
              </div>
            </div>

            {visibleInvoices.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-ink-muted">
                {invoices.length === 0
                  ? 'Não existe fatura cadastrada ainda.'
                  : receberMonthKey
                    ? `Nenhuma cobrança em ${monthLabel(receberMonthKey)}. Use as setas para navegar entre os meses.`
                    : 'Nenhuma cobrança encontrada.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                    <th className="px-5 py-3">Aluno</th>
                    <th className="px-5 py-3">Matrícula</th>
                    <th className="px-5 py-3">Turma</th>
                    <th className="px-5 py-3 text-right">Valor</th>
                    <th className="px-5 py-3">Vencimento</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`cursor-pointer border-b border-border last:border-0 hover:bg-canvas ${selected?.id === inv.id ? 'bg-primary-soft/40' : ''}`}
                      onClick={() => setSelected(inv)}
                    >
                      <td className="px-5 py-3 font-medium text-ink">{inv.student_name}</td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">{inv.registration_number ?? '—'}</td>
                      <td className="px-5 py-3 text-ink-muted">{inv.class_name ?? '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-ink-muted">{brl(inv.amount)}</td>
                      <td className="px-5 py-3 text-ink-muted">{fmtDate(inv.due_date)}</td>
                      <td className="px-5 py-3"><StatusBadge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</StatusBadge></td>
                      <td className="px-5 py-3 text-right">
                        {inv.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-success-soft px-2.5 py-1.5 text-xs font-semibold text-success">
                            <Check size={13} /> Pago
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50"
                              onClick={(e) => { e.stopPropagation(); handleShowQr(inv.id); }}
                              disabled={sendingId === inv.id}
                              title="Gerar/mostrar o QR Code PIX"
                            >
                              {sendingId === inv.id ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />} QR Code
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg bg-success px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
                              onClick={(e) => { e.stopPropagation(); openManual(inv); }}
                              title="Registrar pagamento no caixa (dinheiro / cartão)"
                            >
                              <Check size={13} /> Pago
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white disabled:opacity-50"
                              onClick={(e) => { e.stopPropagation(); handleSendCharge(inv.id); }}
                              disabled={sendingId === inv.id}
                              title="Enviar o código copia-e-cola para o chat do responsável"
                            >
                              {sendingId === inv.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Enviar cobrança
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-3 text-[11px] text-ink-subtle">
              <span className="inline-flex items-center gap-1"><QrCode size={12} /> <b>QR Code</b>: gera e mostra o código para o cliente escanear.</span>
              <span className="inline-flex items-center gap-1"><Check size={12} /> <b>Pago</b>: registra pagamento no caixa (dinheiro/cartão).</span>
              <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> <b>Enviar cobrança</b>: envia o copia-e-cola pro chat do responsável.</span>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
              <Info size={16} className="text-primary" /> Detalhe do split (PIX)
            </div>
            {!selected ? (
              <p className="text-sm text-ink-muted">Selecione uma fatura para ver o detalhamento da taxa de serviço e o valor líquido.</p>
            ) : (
              <>
                <SplitDetail invoice={selected} />
                {selected.status !== 'paid' && selected.status !== 'cancelled' && (
                  <button
                    className="btn-outline mt-4 flex w-full items-center justify-center gap-1.5 text-xs"
                    onClick={() => openManual(selected)}
                  >
                    <Check size={14} /> Registrar pagamento recebido (dinheiro / na escola)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ===================== INADIMPLÊNCIA ===================== */}
      {tab === 'inadimplencia' && (
        <DelinquencyCard rows={delinquency} onViewAll={exportDelinquency} />
      )}

      {/* Registrar pagamento recebido offline */}
      <Modal
        open={!!manualFor}
        onClose={() => !manualSaving && setManualFor(null)}
        title="Registrar pagamento recebido"
        footer={
          <>
            <button className="btn-outline" onClick={() => setManualFor(null)} disabled={manualSaving}>Cancelar</button>
            <button className="btn-primary flex items-center gap-2" onClick={confirmManualPayment} disabled={manualSaving}>
              {manualSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {manualSaving ? 'Registrando…' : 'Confirmar pagamento'}
            </button>
          </>
        }
      >
        {manualFor && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-canvas p-3 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">Aluno</span><span className="font-medium text-ink">{manualFor.student_name}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-ink-muted">Valor</span><span className="font-bold text-ink">{brl(manualFor.amount)}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Forma recebida</label>
                <select className="input" value={manualMethod} onChange={(e) => setManualMethod(e.target.value as any)}>
                  <option value="cash">Dinheiro</option>
                  <option value="pix">PIX (fora do sistema)</option>
                  <option value="card">Cartão (maquininha)</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div>
                <label className="label">Data do pagamento</label>
                <input type="date" className="input" value={manualDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setManualDate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>Baixa manual: a fatura será marcada como <strong>paga</strong>. Este valor <strong>não entra no saldo sacável</strong> (o dinheiro já está com a escola). Não gere/cobre o PIX desta fatura para evitar pagamento em dobro.</span>
            </div>
          </div>
        )}
      </Modal>

      <AdhocChargeModal
        open={adhocOpen}
        onClose={() => setAdhocOpen(false)}
        onCreated={handleAdhocCreated}
        onError={(msg) => showToast('error', msg)}
      />

      {/* Confirmação da cobrança PIX gerada — código copia-e-cola real */}
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
                  <Copy size={13} /> Copiar código
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
  const Row = ({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) => (
    <div className={`flex items-center justify-between py-2 text-sm ${strong ? 'font-bold' : ''}`}>
      <span className={strong ? 'text-ink' : 'text-ink-muted'}>{label}</span>
      <span className={tone ?? 'text-ink'}>{value}</span>
    </div>
  );
  return (
    <div>
      <p className="mb-2 text-xs text-ink-subtle">{invoice.student_name}</p>
      <Row label="Valor pago (bruto)" value={brl(s.grossAmount)} />
      <div className="border-t border-border" />
      <Row label="Taxa da plataforma (5%)" value={`– ${brl(s.platformFeeAmount)}`} tone="text-warning" />
      <div className="border-t border-border" />
      <Row label="Líquido da escola" value={brl(s.schoolNetAmount)} strong tone="text-success" />
      <div className="mt-3 rounded-xl bg-canvas p-3 text-xs text-ink-muted">
        O responsável paga {brl(s.grossAmount)} normalmente. A escola recebe {brl(s.schoolNetAmount)} líquidos;
        a plataforma retém {brl(s.platformFeeAmount)} (5%).
      </div>
    </div>
  );
}
