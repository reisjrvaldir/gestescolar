import { useEffect, useMemo, useState } from 'react';
import {
  CreditCard, Plus, Check, Trash2, Loader2, Pencil, Undo2,
  Download, Filter, X, RotateCcw, History,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExpenseFormModal } from '@/components/finance/ExpenseFormModal';
import {
  expensesService,
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseStatus,
  type ListFilters,
  type AuditEntry,
  type NewExpense,
  type EditExpense,
} from '@/services/expenses';
import { brl } from '@/lib/money';
import { useSubmitOnce } from '@/lib/useSubmitOnce';

type Tab = 'ativas' | 'lixeira' | 'auditoria';

const STATUS: Record<ExpenseStatus, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  paid: { tone: 'success', label: 'Pago' },
  pending: { tone: 'warning', label: 'Pendente' },
  overdue: { tone: 'danger', label: 'Vencido' },
};

const ACTION_LABEL: Record<AuditEntry['action'], string> = {
  create: 'Criada',
  update: 'Editada',
  pay: 'Marcada como paga',
  unpay: 'Pagamento desfeito',
  delete: 'Enviada para a lixeira',
  restore: 'Restaurada',
  purge: 'Excluída definitivamente',
};

function toCSV(rows: Expense[]): string {
  const header = ['Fornecedor', 'Descrição', 'Categoria', 'Valor', 'Vencimento', 'Status', 'Pago em', 'Parcela'];
  const lines = rows.map((e) => [
    e.supplier_name,
    e.description ?? '',
    e.category ?? '',
    Number(e.amount).toFixed(2).replace('.', ','),
    e.due_date ?? '',
    STATUS[e.status]?.label ?? e.status,
    e.paid_at ? new Date(e.paid_at).toLocaleDateString('pt-BR') : '',
    e.installment_number && e.installment_total ? `${e.installment_number}/${e.installment_total}` : '',
  ].map(csvField).join(';'));
  return [header.join(';'), ...lines].join('\r\n');
}
function csvField(v: string): string {
  const s = String(v ?? '');
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCSV(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function ExpensesPage() {
  const [tab, setTab] = useState<Tab>('ativas');
  const [items, setItems] = useState<Expense[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ListFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<Expense | null>(null);
  const [confirmPay, setConfirmPay] = useState<Expense | null>(null);

  async function reload(currentTab: Tab = tab, currentFilters: ListFilters = filters) {
    setLoading(true);
    try {
      if (currentTab === 'auditoria') {
        setAudit(await expensesService.audit({ from: currentFilters.from, to: currentFilters.to }));
      } else {
        setItems(await expensesService.list({ ...currentFilters, trash: currentTab === 'lixeira' }));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { void reload(tab, filters); /* eslint-disable-next-line */ }, [tab]);

  const totals = useMemo(() => {
    const pending = items.filter((e) => e.status === 'pending');
    const paid = items.filter((e) => e.status === 'paid');
    return {
      pending,
      paid,
      totalPending: pending.reduce((s, e) => s + Number(e.amount), 0),
      totalPaid: paid.reduce((s, e) => s + Number(e.amount), 0),
    };
  }, [items]);

  // ---------------- Handlers (atualização otimista) ----------------

  async function handleCreate(data: NewExpense) {
    const created = await expensesService.create(data);
    setItems((prev) => [...created, ...prev]);
  }

  async function handleEdit(id: string, data: EditExpense) {
    const updated = await expensesService.update(id, data);
    setItems((prev) => prev.map((e) => (e.id === id ? updated : e)));
  }

  async function handlePay(exp: Expense) {
    const updated = await expensesService.markPaid(exp.id);
    setItems((prev) => prev.map((e) => (e.id === exp.id ? updated : e)));
  }

  async function handleUnpay(exp: Expense) {
    const updated = await expensesService.markUnpaid(exp.id);
    setItems((prev) => prev.map((e) => (e.id === exp.id ? updated : e)));
  }

  async function handleDelete(exp: Expense) {
    await expensesService.remove(exp.id);
    setItems((prev) => prev.filter((e) => e.id !== exp.id));
  }

  async function handleRestore(exp: Expense) {
    await expensesService.restore(exp.id);
    setItems((prev) => prev.filter((e) => e.id !== exp.id));
  }

  async function handlePurge(exp: Expense) {
    await expensesService.purge(exp.id);
    setItems((prev) => prev.filter((e) => e.id !== exp.id));
  }

  const { run: onPayClick } = useSubmitOnce(handlePay);
  const { run: onUnpayClick } = useSubmitOnce(handleUnpay);
  const { run: onRestoreClick } = useSubmitOnce(handleRestore);

  function onExport() {
    const filename = `saidas-de-recursos-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(filename, toCSV(items));
  }

  function applyFilters() { void reload(tab, filters); }
  function clearFilters() { setFilters({}); void reload(tab, {}); }

  const isTrash = tab === 'lixeira';

  return (
    <>
      <PageHeader
        title="Contas a Pagar"
        subtitle="Gerencie as despesas e contas a pagar da escola."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-outline"
              onClick={() => setShowFilters((v) => !v)}
              title="Filtros para auditoria de gastos"
            >
              <Filter size={16} /> Filtros
            </button>
            <button className="btn-outline" onClick={onExport} title="Exportar saídas de recursos">
              <Download size={16} /> Exportar
            </button>
            <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus size={16} /> Nova despesa
            </button>
          </div>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-border">
        <TabButton active={tab === 'ativas'} onClick={() => setTab('ativas')}>Ativas</TabButton>
        <TabButton active={tab === 'lixeira'} onClick={() => setTab('lixeira')}>
          <Trash2 size={14} /> Lixeira
        </TabButton>
        <TabButton active={tab === 'auditoria'} onClick={() => setTab('auditoria')}>
          <History size={14} /> Auditoria
        </TabButton>
      </div>

      {showFilters && (
        <div className="card mb-4 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <label className="label text-xs">Status</label>
              <select
                className="input"
                value={filters.status ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as ExpenseStatus | undefined }))}
              >
                <option value="">Todos</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="overdue">Vencido</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Categoria</label>
              <select
                className="input"
                value={filters.category ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}
              >
                <option value="">Todas</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Fornecedor</label>
              <input
                className="input"
                placeholder="Buscar…"
                value={filters.supplier ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value || undefined }))}
              />
            </div>
            <div>
              <label className="label text-xs">De</label>
              <input
                type="date"
                className="input"
                value={filters.from ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
              />
            </div>
            <div>
              <label className="label text-xs">Até</label>
              <input
                type="date"
                className="input"
                value={filters.to ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-outline" onClick={clearFilters}><X size={14} /> Limpar</button>
            <button className="btn-primary" onClick={applyFilters}>Aplicar filtros</button>
          </div>
        </div>
      )}

      {tab !== 'auditoria' && !isTrash && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Total pendente" value={brl(totals.totalPending)} icon={CreditCard} tone="warning" hint={`${totals.pending.length} conta(s)`} />
          <MetricCard label="Total pago" value={brl(totals.totalPaid)} icon={CreditCard} tone="success" hint={`${totals.paid.length} conta(s)`} />
          <MetricCard label="Total geral" value={brl(totals.totalPending + totals.totalPaid)} icon={CreditCard} tone="primary" />
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center py-12 text-ink-muted">
          <Loader2 className="animate-spin" size={20} />
          <span className="ml-2 text-sm">Carregando…</span>
        </div>
      ) : tab === 'auditoria' ? (
        <AuditTable rows={audit} />
      ) : items.length === 0 ? (
        <div className="card overflow-hidden">
          <EmptyState
            icon={isTrash ? Trash2 : CreditCard}
            title={isTrash ? 'Lixeira vazia' : 'Nenhuma despesa cadastrada'}
            description={isTrash
              ? 'Itens excluídos aparecem aqui e são apagados definitivamente após 60 dias.'
              : 'Registre a primeira conta a pagar.'}
            action={!isTrash
              ? <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} /> Nova despesa</button>
              : undefined}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                  <th className="px-4 py-3">Fornecedor</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3 font-medium text-ink">
                      {e.supplier_name}
                      {e.installment_number && e.installment_total && (
                        <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                          {e.installment_number}/{e.installment_total}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{e.description ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{e.category ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-ink">{brl(Number(e.amount))}</td>
                    <td className="px-4 py-3 text-ink-muted">{e.due_date ? new Date(e.due_date).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</StatusBadge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {isTrash ? (
                          <>
                            <button
                              className="btn-outline !h-8 !px-3 !py-0 text-xs"
                              onClick={() => void onRestoreClick(e)}
                              title="Restaurar"
                            >
                              <Undo2 size={14} /> Restaurar
                            </button>
                            <button
                              className="btn-danger !h-8 !px-3 !py-0 text-xs"
                              onClick={() => setConfirmPurge(e)}
                              title="Excluir definitivamente"
                            >
                              <Trash2 size={14} /> Excluir agora
                            </button>
                          </>
                        ) : (
                          <>
                            {e.status !== 'paid' ? (
                              <button
                                className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
                                onClick={() => setConfirmPay(e)}
                                title="Marcar como pago"
                              >
                                <Check size={14} /> Pago
                              </button>
                            ) : (
                              <button
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-canvas"
                                onClick={() => void onUnpayClick(e)}
                                title="Desfazer pagamento"
                              >
                                <RotateCcw size={14} /> Desfazer
                              </button>
                            )}
                            <button
                              className="rounded-lg border border-border bg-surface p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
                              onClick={() => { setEditing(e); setFormOpen(true); }}
                              title="Editar"
                            >
                              <Pencil size={15} />
                            </button>
                            <div className="mx-1 h-6 w-px bg-border" />
                            <button
                              className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger"
                              onClick={() => setConfirmDelete(e)}
                              title="Excluir"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isTrash && !loading && items.length > 0 && (
        <p className="mt-3 text-xs text-ink-subtle">
          A lixeira mantém itens por 60 dias antes de excluí-los definitivamente.
        </p>
      )}

      <ExpenseFormModal
        open={formOpen}
        expense={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onCreate={handleCreate}
        onEdit={handleEdit}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Enviar para a lixeira?"
        description={confirmDelete
          ? `A despesa "${confirmDelete.supplier_name}" (${brl(Number(confirmDelete.amount))}) será movida para a lixeira e apagada em 60 dias.`
          : ''}
        confirmLabel="Excluir"
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) await handleDelete(confirmDelete); }}
      />

      <ConfirmDialog
        open={!!confirmPurge}
        title="Excluir definitivamente?"
        description={confirmPurge
          ? `Esta ação é irreversível. A despesa "${confirmPurge.supplier_name}" será removida do sistema.`
          : ''}
        confirmLabel="Excluir para sempre"
        onClose={() => setConfirmPurge(null)}
        onConfirm={async () => { if (confirmPurge) await handlePurge(confirmPurge); }}
      />

      <ConfirmDialog
        open={!!confirmPay}
        tone="primary"
        title="Confirmar pagamento?"
        description={confirmPay
          ? `Marcar "${confirmPay.supplier_name}" (${brl(Number(confirmPay.amount))}) como PAGO. Esta ação será registrada no log de alterações.`
          : ''}
        confirmLabel="Salvar como pago"
        onClose={() => setConfirmPay(null)}
        onConfirm={async () => { if (confirmPay) await onPayClick(confirmPay); }}
      />
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition ${
        active ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function AuditTable({ rows }: { rows: AuditEntry[] }) {
  if (rows.length === 0) {
    return (
      <div className="card overflow-hidden">
        <EmptyState
          icon={History}
          title="Nenhuma alteração registrada"
          description="Todas as ações em despesas (criação, edição, pagamento, exclusão) aparecerão aqui."
        />
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Autor</th>
              <th className="px-4 py-3">Despesa</th>
              <th className="px-4 py-3">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const label = r.after?.supplier_name ?? r.before?.supplier_name ?? '—';
              const detail = summarizeChange(r);
              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-ink-muted">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 font-medium text-ink">{ACTION_LABEL[r.action] ?? r.action}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.actor_name ?? '—'} <span className="text-xs text-ink-subtle">({r.actor_role ?? '—'})</span></td>
                  <td className="px-4 py-3 text-ink">{label}</td>
                  <td className="px-4 py-3 text-ink-muted">{detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summarizeChange(r: AuditEntry): string {
  if (r.action === 'create') return `Valor ${brl(Number(r.after?.amount ?? 0))}`;
  if (r.action === 'pay') return `Pago em ${new Date(r.after?.paid_at ?? Date.now()).toLocaleDateString('pt-BR')}`;
  if (r.action === 'unpay') return 'Pagamento revertido';
  if (r.action === 'delete') return 'Movida para a lixeira';
  if (r.action === 'restore') return 'Restaurada da lixeira';
  if (r.action === 'purge') return 'Removida definitivamente';
  if (r.action === 'update' && r.before && r.after) {
    const diffs: string[] = [];
    const fields: Array<[keyof any, string, (v: any) => string]> = [
      ['supplier_name', 'fornecedor', (v) => String(v ?? '—')],
      ['description', 'descrição', (v) => String(v ?? '—')],
      ['category', 'categoria', (v) => String(v ?? '—')],
      ['amount', 'valor', (v) => brl(Number(v ?? 0))],
      ['due_date', 'vencimento', (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '—'],
    ];
    for (const [k, label, fmt] of fields) {
      const b = (r.before as any)[k];
      const a = (r.after as any)[k];
      if (String(b ?? '') !== String(a ?? '')) diffs.push(`${label}: ${fmt(b)} → ${fmt(a)}`);
    }
    return diffs.join(' • ') || 'Sem alterações';
  }
  return '—';
}
