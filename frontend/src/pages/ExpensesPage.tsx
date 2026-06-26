import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CreditCard, Plus, Check, Trash2, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { expensesService, type Expense, type NewExpense } from '@/services/expenses';
import { brl } from '@/lib/fees';

const STATUS: Record<Expense['status'], { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid: { tone: 'success', label: 'Pago' },
  pending: { tone: 'warning', label: 'Pendente' },
  overdue: { tone: 'danger', label: 'Vencido' },
};

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewExpense>();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setExpenses(await expensesService.list()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onCreate(data: NewExpense) {
    await expensesService.create({ ...data, amount: Number(data.amount) });
    await load();
    reset();
    setOpen(false);
  }

  async function onPay(id: string) {
    await expensesService.markPaid(id);
    await load();
  }

  async function onRemove(id: string) {
    await expensesService.remove(id);
    await load();
  }

  const pending = expenses.filter((e) => e.status === 'pending');
  const paid = expenses.filter((e) => e.status === 'paid');
  const totalPending = pending.reduce((s, e) => s + Number(e.amount), 0);
  const totalPaid = paid.reduce((s, e) => s + Number(e.amount), 0);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Contas a Pagar"
        subtitle="Gerencie as despesas e contas a pagar da escola."
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Nova despesa
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total pendente" value={brl(totalPending)} icon={CreditCard} tone="warning" hint={`${pending.length} conta(s)`} />
        <MetricCard label="Total pago" value={brl(totalPaid)} icon={CreditCard} tone="success" hint={`${paid.length} conta(s)`} />
        <MetricCard label="Total geral" value={brl(totalPending + totalPaid)} icon={CreditCard} tone="primary" />
      </div>

      <div className="card overflow-hidden">
        {expenses.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhuma despesa cadastrada"
            description="Registre a primeira conta a pagar."
            action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nova despesa</button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3 font-medium text-ink">{e.supplier_name}</td>
                  <td className="px-4 py-3 text-ink-muted">{e.description ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{brl(e.amount)}</td>
                  <td className="px-4 py-3 text-ink-muted">{e.due_date ? new Date(e.due_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3"><StatusBadge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</StatusBadge></td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {e.status !== 'paid' && (
                        <button
                          className="rounded-lg p-1.5 text-ink-muted hover:bg-success-soft hover:text-success"
                          onClick={() => onPay(e.id)}
                          title="Marcar como pago"
                        >
                          <Check size={15} />
                        </button>
                      )}
                      <button
                        className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger"
                        onClick={() => onRemove(e.id)}
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={open}
        title="Nova despesa"
        onClose={() => { reset(); setOpen(false); }}
        footer={
          <>
            <button className="btn-outline" onClick={() => { reset(); setOpen(false); }}>Cancelar</button>
            <button className="btn-primary" form="expense-form" type="submit">Criar despesa</button>
          </>
        }
      >
        <form id="expense-form" className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div>
            <label className="label">Fornecedor *</label>
            <input className="input" placeholder="Ex.: Papelaria Central" {...register('supplier_name', { required: 'Informe o fornecedor' })} />
            {errors.supplier_name && <p className="mt-1 text-xs text-danger">{errors.supplier_name.message}</p>}
          </div>
          <div>
            <label className="label">Descrição</label>
            <input className="input" placeholder="Ex.: Material didático" {...register('description')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Valor (R$) *</label>
              <input type="number" step="0.01" min="0.01" className="input" placeholder="150.00" {...register('amount', { required: 'Informe o valor', min: { value: 0.01, message: 'Mínimo R$0,01' } })} />
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
