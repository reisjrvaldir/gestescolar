import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Loader2, Info, Check, AlertTriangle, Copy } from 'lucide-react';
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
import { quickActionsData } from '@/data/finance/quickActionsData';
import { invoicesService, type Invoice } from '@/services/invoices';
import { expensesService, type Expense } from '@/services/expenses';
import { financeService, type FinanceSummary, type MonthlyBalancePoint, type DelinquentInvoice } from '@/services/finance';
import { calculatePixSplit, brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';

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

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [inv, exp, summ, mon, delq] = await Promise.all([
        invoicesService.list(),
        expensesService.list(),
        financeService.summary(),
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

  // Gera (ou renova) a cobrança PIX real da fatura — endpoint real do gateway.
  async function handleSendCharge(id: string) {
    setSendingId(id);
    try {
      const charge = await invoicesService.generatePix(id);
      const inv = invoices.find((i) => i.id === id);
      setPixResult({ studentName: inv?.student_name ?? '—', copyPaste: charge.pixCopyPaste });
      showToast('success', 'Cobrança PIX gerada com sucesso — disponível no portal do responsável.');
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao gerar a cobrança PIX.');
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
        showToast('error', 'Registro manual de pagamento — disponível em breve.');
        break;
      case 'exportar-relatorio':
        exportReceivables();
        break;
      default:
        showToast('error', 'Ação em breve.');
    }
  }

  const goExpenses = () => navigate('/app/finance/expenses');

  function exportReceivables() {
    if (invoices.length === 0) { showToast('error', 'Nada a exportar ainda.'); return; }
    downloadCsv(
      `a-receber-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Aluno', 'Responsável', 'Turma', 'Valor', 'Vencimento', 'Referência', 'Status'],
      invoices.map((i) => [
        i.student_name, i.guardian_name ?? '', i.class_name ?? '',
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
          <FinanceSummaryCards summary={summary} />
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
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-ink">A receber</h3>
                <p className="mt-0.5 text-xs text-ink-muted">Mensalidades e cobranças avulsas dos alunos.</p>
              </div>
              <button className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas" onClick={() => setAdhocOpen(true)}>
                <Plus size={14} /> Nova cobrança avulsa
              </button>
            </div>
            {invoices.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-ink-muted">Nenhuma fatura cadastrada ainda.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                    <th className="px-5 py-3">Aluno</th>
                    <th className="px-5 py-3 text-right">Valor</th>
                    <th className="px-5 py-3">Vencimento</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`cursor-pointer border-b border-border last:border-0 hover:bg-canvas ${selected?.id === inv.id ? 'bg-primary-soft/40' : ''}`}
                      onClick={() => setSelected(inv)}
                    >
                      <td className="px-5 py-3 font-medium text-ink">{inv.student_name}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-ink-muted">{brl(inv.amount)}</td>
                      <td className="px-5 py-3 text-ink-muted">{fmtDate(inv.due_date)}</td>
                      <td className="px-5 py-3"><StatusBadge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</StatusBadge></td>
                      <td className="px-5 py-3 text-right">
                        {inv.status !== 'paid' && (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white disabled:opacity-50"
                            onClick={(e) => { e.stopPropagation(); handleSendCharge(inv.id); }}
                            disabled={sendingId === inv.id}
                          >
                            {sendingId === inv.id ? <Loader2 size={13} className="animate-spin" /> : null} Enviar cobrança
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="border-t border-border px-5 py-3 text-[11px] text-ink-subtle">
              Ao clicar em “Enviar cobrança”, o código PIX é gerado e fica disponível no portal do responsável.
            </p>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
              <Info size={16} className="text-primary" /> Detalhe do split (PIX)
            </div>
            {!selected ? (
              <p className="text-sm text-ink-muted">Selecione uma fatura para ver o detalhamento da taxa de serviço e o valor líquido.</p>
            ) : (
              <SplitDetail invoice={selected} />
            )}
          </div>
        </div>
      )}

      {/* ===================== INADIMPLÊNCIA ===================== */}
      {tab === 'inadimplencia' && (
        <DelinquencyCard rows={delinquency} onViewAll={exportDelinquency} />
      )}

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
