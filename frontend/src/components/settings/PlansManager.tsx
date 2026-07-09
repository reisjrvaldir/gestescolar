import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Pencil, Loader2, DollarSign } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { schoolPlansService, type SchoolPlan, type NewSchoolPlan } from '@/services/schoolPlans';
import { brl } from '@/lib/fees';

export function PlansManager() {
  const [plans, setPlans] = useState<SchoolPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewSchoolPlan>();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setPlans(await schoolPlansService.list()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    reset({ name: '', monthly_fee: 0 });
    setOpen(true);
  }

  function openEdit(p: SchoolPlan) {
    setEditing(p);
    reset({ name: p.name, monthly_fee: Number(p.monthly_fee) });
    setOpen(true);
  }

  function close() { reset(); setEditing(null); setOpen(false); }

  async function onSubmit(data: NewSchoolPlan) {
    if (saving) return; // evita double-submit (planos duplicados)
    setSaving(true);
    try {
      const payload = { ...data, monthly_fee: Number(data.monthly_fee) };
      if (editing) {
        await schoolPlansService.update(editing.id, payload);
      } else {
        await schoolPlansService.create(payload);
      }
      await load();
      close();
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    if (!window.confirm('Inativar este plano? Alunos já vinculados mantêm a mensalidade atual.')) return;
    await schoolPlansService.remove(id);
    await load();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-ink">Planos / Mensalidades</h3>
        </div>
        <button className="btn-primary text-xs" onClick={openNew}>
          <Plus size={14} /> Novo plano
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-ink-muted">
          <Loader2 className="animate-spin" size={16} /> Carregando…
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Nenhum plano cadastrado"
          description="Cadastre os planos de mensalidade da escola (ex.: Integral, Meio Período)."
          action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Novo plano</button>}
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Mensalidade</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-canvas">
                <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                <td className="px-4 py-3 text-ink-muted">{brl(Number(p.monthly_fee))}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-soft hover:text-primary" onClick={() => openEdit(p)} title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => onRemove(p.id)} title="Inativar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={open}
        title={editing ? 'Editar plano' : 'Novo plano'}
        onClose={close}
        footer={
          <>
            <button className="btn-outline" onClick={close} disabled={saving}>Cancelar</button>
            <button className="btn-primary" form="plan-form" type="submit" disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />} {editing ? 'Salvar' : 'Criar'}
            </button>
          </>
        }
      >
        <form id="plan-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="label">Nome do plano *</label>
            <input className="input" placeholder="Ex.: Integral, Meio Período" {...register('name', { required: 'Informe o nome' })} />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Mensalidade (R$) *</label>
            <input type="number" step="0.01" min="0" className="input" placeholder="0,00"
              {...register('monthly_fee', { required: 'Informe o valor', min: { value: 0, message: 'Inválido' }, valueAsNumber: true })} />
            {errors.monthly_fee && <p className="mt-1 text-xs text-danger">{errors.monthly_fee.message}</p>}
          </div>
        </form>
      </Modal>
    </div>
  );
}
