import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Loader2, Check, AlertTriangle, Wallet,
} from 'lucide-react';
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

export function FinancePage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyBalancePoint[]>([]);
  const [delinquency, setDelinquency] = useState<DelinquentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [visaoRange, setVisaoRange] = useState<PeriodRange>(() => todayRange('month'));

  useEffect(() => { load(); }, []);

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

  async function handleSendCharge(id: string) {
    setSendingId(id);
    try {
      await invoicesService.sendChargeToGuardian(id);
      const inv = invoices.find((i) => i.id === id);
      showToast('success', `Cobrança enviada para o responsável de ${inv?.student_name ?? 'aluno'}.`);
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao enviar a cobrança.');
    } finally {
      setSendingId(null);
    }
  }

  function handleQuickAction(key: string) {
    switch (key) {
      case 'nova-despesa':
      case 'importar-despesas':
        navigate('/app/finance/expenses');
        break;
      case 'nova-cobranca':
      case 'gerar-pix':
      case 'cobranca-lote':
        setAdhocOpen(true);
        break;
      case 'ver-inadimplentes':
        navigate('/app/finance/delinquency');
        break;
      case 'registrar-pagamento':
        navigate('/app/finance/receivables');
        break;
      case 'exportar-relatorio':
        showToast('success', 'Navegue para "A receber" ou "Contas a Pagar" para exportar.');
        break;
      default:
        showToast('error', 'Ação em breve.');
    }
  }

  const goExpenses = () => navigate('/app/finance/expenses');

  if (loading || !summary) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      {/* ===== HERO ===== */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EDE9FE] via-[#F3EEFF] to-[#F5F3FF] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Financeiro</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Acompanhe receitas, despesas, cobranças e inadimplência da escola em um só lugar.
            </p>
            <button
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-purple/90"
              onClick={() => setAdhocOpen(true)}
            >
              <Plus size={18} /> Nova cobrança avulsa
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
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
          toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />} {toast.msg}
        </div>
      )}

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
            onViewAll={() => navigate('/app/finance/receivables')}
            sendingId={sendingId}
          />
        </div>

        <DelinquencyCard rows={delinquency} onViewAll={() => navigate('/app/finance/delinquency')} />

        <QuickActionsGrid actions={quickActionsData} onAction={handleQuickAction} />
      </div>

      <AdhocChargeModal
        open={adhocOpen}
        onClose={() => setAdhocOpen(false)}
        onCreated={(result) => { showToast('success', `Cobrança criada para ${result.invoicesCreated} aluno(s).`); load(); }}
        onError={(msg) => showToast('error', msg)}
      />
    </>
  );
}
