import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Wallet, AlertTriangle, PiggyBank, TrendingUp, Info, Plus, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { invoicesService, type Invoice, type NewInvoice } from '@/services/invoices';
import { calculatePixSplit, brl } from '@/lib/fees';

const STATUS: Record<Invoice['status'], { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid: { tone: 'success', label: 'Pago' },
  pending: { tone: 'warning', label: 'Pendente' },
  overdue: { tone: 'danger', label: 'Vencido' },
  cancelled: { tone: 'danger', label: 'Cancelado' },
  refunded: { tone: 'warning', label: 'Estornado' },
};

export function FinancePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewInvoice>();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await invoicesService.list();
      setInvoices(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onCreate(data: NewInvoice) {
    await invoicesService.create({ ...data, amount: Number(data.amount) });
    await load();
    reset();
    setOpen(false);
  }

  const paid = invoices.filter((i) => i.status === 'paid');
  const overdue = invoices.filter((i) => i.status === 'overdue');

  const totals = paid.reduce(
    (acc, inv) => {
      const s = calculatePixSplit(inv.amount);
      acc.gross += s.grossAmount;
      acc.net += s.schoolNetAmount;
      acc.fees += s.totalServiceFee;
      return acc;
    },
    { gross: 0, net: 0, fees: 0 },
  );

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Visão geral das finanças da sua escola."
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Nova fatura
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recebido (bruto)" value={brl(totals.gross)} icon={TrendingUp} tone="primary" />
        <MetricCard label="Líquido da escola" value={brl(totals.net)} icon={PiggyBank} tone="success" hint="já descontadas as taxas" />
        <MetricCard label="Taxas de serviço" value={brl(totals.fees)} icon={Wallet} tone="warning" hint="Nuvende R$1,99 + 3%" />
        <MetricCard label="Inadimplência" value={brl(overdue.reduce((s, i) => s + i.amount, 0))} icon={AlertTriangle} tone="danger" hint={`${overdue.length} fatura(s)`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-border px-4 py-3 text-sm font-bold text-ink">Faturas</div>
          {invoices.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-ink-muted">Nenhuma fatura cadastrada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                  <th className="px-4 py-3">Aluno</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`border-b border-border last:border-0 cursor-pointer hover:bg-canvas ${selected?.id === inv.id ? 'bg-primary-soft/40' : ''}`}
                    onClick={() => setSelected(inv)}
                  >
                    <td className="px-4 py-3 font-medium text-ink">{inv.student_name}</td>
                    <td className="px-4 py-3 text-ink-muted">{brl(inv.amount)}</td>
                    <td className="px-4 py-3 text-ink-muted">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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

      <Modal
        open={open}
        title="Nova fatura"
        onClose={() => { reset(); setOpen(false); }}
        footer={
          <>
            <button className="btn-outline" onClick={() => { reset(); setOpen(false); }}>Cancelar</button>
            <button className="btn-primary" form="invoice-form" type="submit">Criar fatura</button>
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
