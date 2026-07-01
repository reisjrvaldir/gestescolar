import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Info, Check } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { FinanceSummaryCards } from '@/components/finance/FinanceSummaryCards';
import { RevenueExpenseChart } from '@/components/finance/RevenueExpenseChart';
import { PayablesCard } from '@/components/finance/PayablesCard';
import { ReceivablesCard } from '@/components/finance/ReceivablesCard';
import { DelinquencyCard } from '@/components/finance/DelinquencyCard';
import { QuickActionsGrid } from '@/components/finance/QuickActionsGrid';
import { financeSummary } from '@/data/finance/financeSummary';
import { financeChartData } from '@/data/finance/financeChartData';
import { payablesData } from '@/data/finance/payablesData';
import { receivablesData } from '@/data/finance/receivablesData';
import { delinquencyData } from '@/data/finance/delinquencyData';
import { quickActionsData } from '@/data/finance/quickActionsData';
import { invoicesService, type Invoice, type NewInvoice } from '@/services/invoices';
import { calculatePixSplit, brl } from '@/lib/fees';

const TABS = [
  { key: 'visao', label: 'Visão geral' },
  { key: 'pagar', label: 'Contas a pagar' },
  { key: 'receber', label: 'A receber' },
  { key: 'inadimplencia', label: 'Inadimplência' },
];

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
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewInvoice>();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      setInvoices(await invoicesService.list());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  // --- Funcionalidade real preservada: criar fatura ---
  async function onCreate(data: NewInvoice) {
    await invoicesService.create({ ...data, amount: Number(data.amount) });
    await load();
    reset();
    setOpen(false);
    showToast('Fatura criada com sucesso.');
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  // Ação mock: no futuro dispara o código PIX ao app do responsável (WhatsApp/push).
  function handleSendCharge(id: string) {
    showToast(`Código PIX enviado ao responsável (cobrança ${id}).`);
    // TODO: integrar com POST /api/invoices/:id/send-charge → notifica app do responsável.
  }

  function handleQuickAction(key: string) {
    switch (key) {
      case 'nova-despesa':
      case 'importar-despesas':
        navigate('/app/finance/expenses');
        break;
      case 'nova-cobranca':
      case 'gerar-pix':
        setOpen(true);
        break;
      case 'ver-inadimplentes':
        setTab('inadimplencia');
        break;
      case 'cobranca-lote':
        showToast('Envio de cobrança em lote — disponível em breve.');
        break;
      case 'registrar-pagamento':
        showToast('Registro de pagamento — disponível em breve.');
        break;
      case 'exportar-relatorio':
        showToast('Exportação de relatório — disponível em breve.');
        break;
      default:
        showToast('Ação em breve.');
    }
  }

  const goExpenses = () => navigate('/app/finance/expenses');

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Gerencie receitas, despesas, contas a pagar, a receber e inadimplência da sua escola."
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Nova cobrança
          </button>
        }
      />

      <FinanceTabs tabs={TABS} active={tab} onChange={setTab} />

      {toast && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-success-soft px-4 py-2.5 text-sm font-medium text-success">
          <Check size={16} /> {toast}
        </div>
      )}

      {/* ===================== VISÃO GERAL ===================== */}
      {tab === 'visao' && (
        <div className="space-y-6">
          <FinanceSummaryCards cards={financeSummary} />
          <RevenueExpenseChart data={financeChartData} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <PayablesCard rows={payablesData} onNew={goExpenses} onViewAll={goExpenses} />
            <ReceivablesCard
              rows={receivablesData}
              onNew={() => setOpen(true)}
              onSend={handleSendCharge}
              onViewAll={() => setTab('receber')}
            />
          </div>

          <DelinquencyCard rows={delinquencyData} onViewAll={() => setTab('inadimplencia')} />

          <QuickActionsGrid actions={quickActionsData} onAction={handleQuickAction} />
        </div>
      )}

      {/* ===================== CONTAS A PAGAR ===================== */}
      {tab === 'pagar' && (
        <div className="space-y-4">
          <PayablesCard rows={payablesData} onNew={goExpenses} onViewAll={goExpenses} />
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
                <p className="mt-0.5 text-xs text-ink-muted">Faturas e mensalidades dos alunos.</p>
              </div>
              <button className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas" onClick={() => setOpen(true)}>
                <Plus size={14} /> Nova cobrança
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-14 text-ink-muted"><Loader2 className="animate-spin" size={18} /> Carregando…</div>
            ) : invoices.length === 0 ? (
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
                      <td className="px-5 py-3 text-ink-muted">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-5 py-3"><StatusBadge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</StatusBadge></td>
                      <td className="px-5 py-3 text-right">
                        <button
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white"
                          onClick={(e) => { e.stopPropagation(); handleSendCharge(inv.id); }}
                        >
                          Enviar cobrança
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="border-t border-border px-5 py-3 text-[11px] text-ink-subtle">
              Ao clicar em “Enviar cobrança”, o código PIX é enviado diretamente para o app do responsável.
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
        <DelinquencyCard rows={delinquencyData} onViewAll={() => showToast('Lista completa de inadimplentes — disponível em breve.')} />
      )}

      {/* Modal real de nova fatura (funcionalidade preservada) */}
      <Modal
        open={open}
        title="Nova cobrança"
        onClose={() => { reset(); setOpen(false); }}
        footer={
          <>
            <button className="btn-outline" onClick={() => { reset(); setOpen(false); }}>Cancelar</button>
            <button className="btn-primary" form="invoice-form" type="submit">Criar cobrança</button>
          </>
        }
      >
        <form id="invoice-form" className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div>
            <label className="label">Nome do aluno *</label>
            <input className="input" placeholder="Ex.: Ana Beatriz Souza" {...register('student_name', { required: 'Informe o nome do aluno' })} />
            {errors.student_name && <p className="mt-1 text-xs text-danger">{errors.student_name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Valor (R$) *</label>
              <input type="number" step="0.01" min="0.01" className="input" placeholder="250.00" {...register('amount', { required: 'Informe o valor', min: { value: 0.01, message: 'Mínimo R$0,01' } })} />
              {errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="label">Vencimento</label>
              <input type="date" className="input" {...register('due_date')} />
            </div>
          </div>
        </form>
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
      <Row label="Taxa Nuvende (fixa)" value={`– ${brl(s.nuvendePixFee)}`} tone="text-warning" />
      <Row label="Taxa plataforma (3%)" value={`– ${brl(s.platformFeeAmount)}`} tone="text-warning" />
      <Row label="Taxa total de serviço" value={`– ${brl(s.totalServiceFee)}`} />
      <div className="border-t border-border" />
      <Row label="Líquido da escola" value={brl(s.schoolNetAmount)} strong tone="text-success" />
      <div className="mt-3 rounded-xl bg-canvas p-3 text-xs text-ink-muted">
        O responsável paga {brl(s.grossAmount)} normalmente. A escola recebe {brl(s.schoolNetAmount)};
        a plataforma retém {brl(s.platformFeeAmount)} (3%) e a Nuvende {brl(s.nuvendePixFee)}.
      </div>
    </div>
  );
}
