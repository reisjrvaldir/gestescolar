import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Plus, Pencil, Trash2, Check, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { saasService, type SaasPlanFull, type PlanInput } from '@/services/saas';
import { brl } from '@/lib/fees';

const EMPTY: PlanInput = {
  name: '', student_limit: null, monthly_price: 0, annual_price: 0,
  discount_percentage: 15, is_public: true, is_pilot: false, features_json: [],
};

export function SaasPlansConfigPage() {
  const [plans, setPlans] = useState<SaasPlanFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; form: PlanInput } | null>(null);
  const [featuresText, setFeaturesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPlans(await saasService.plans());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar os planos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing({ id: null, form: { ...EMPTY } });
    setFeaturesText('');
  }
  function openEdit(p: SaasPlanFull) {
    setEditing({
      id: p.id,
      form: {
        name: p.name, student_limit: p.student_limit, monthly_price: p.monthly_price,
        annual_price: p.annual_price, discount_percentage: p.discount_percentage,
        is_public: p.is_public, is_pilot: p.is_pilot, features_json: p.features_json,
      },
    });
    setFeaturesText((p.features_json ?? []).join('\n'));
  }

  function patch(part: Partial<PlanInput>) {
    setEditing((e) => (e ? { ...e, form: { ...e.form, ...part } } : e));
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const body: PlanInput = {
        ...editing.form,
        features_json: featuresText.split('\n').map((s) => s.trim()).filter(Boolean),
      };
      if (editing.id) await saasService.updatePlan(editing.id, body);
      else await saasService.createPlan(body);
      showToast('success', editing.id ? 'Plano atualizado.' : 'Plano criado.');
      setEditing(null);
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao salvar o plano.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await saasService.deletePlan(deleteId);
      showToast('success', 'Plano excluído.');
      setDeleteId(null);
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao excluir o plano.');
      setDeleteId(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando planos…</span></div>;
  }
  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-danger">{error}</p>
        <button className="btn-outline mt-4" onClick={load}><RefreshCw size={15} /> Tentar novamente</button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Configuração de planos"
        subtitle="Cadastre e edite os planos que as escolas assinam."
        actions={<button className="btn-primary" onClick={openNew}><Plus size={15} /> Novo plano</button>}
      />

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />} {toast.msg}
        </div>
      )}

      <div className="card overflow-hidden">
        {plans.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-subtle">Nenhum plano cadastrado. Crie o primeiro.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                  <th className="px-5 py-2.5">Plano</th>
                  <th className="px-5 py-2.5 text-right">Mensal</th>
                  <th className="hidden px-5 py-2.5 text-right sm:table-cell">Anual</th>
                  <th className="hidden px-5 py-2.5 text-right md:table-cell">Alunos</th>
                  <th className="px-5 py-2.5">Visibilidade</th>
                  <th className="hidden px-5 py-2.5 text-right lg:table-cell">Escolas</th>
                  <th className="px-5 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-canvas">
                    <td className="px-5 py-2.5 font-medium text-ink">{p.name}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-ink">{brl(p.monthly_price)}</td>
                    <td className="hidden px-5 py-2.5 text-right text-ink-muted sm:table-cell">{brl(p.annual_price)}</td>
                    <td className="hidden px-5 py-2.5 text-right text-ink-muted md:table-cell">{p.student_limit ?? 'Ilimitado'}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge tone={p.is_public ? 'success' : 'neutral'}>{p.is_public ? 'Público' : 'Privado'}</StatusBadge>
                        {p.is_pilot && <StatusBadge tone="warning">Piloto</StatusBadge>}
                      </div>
                    </td>
                    <td className="hidden px-5 py-2.5 text-right text-ink-muted lg:table-cell">{p.schools_count}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink" onClick={() => openEdit(p)} title="Editar"><Pencil size={15} /></button>
                        <button className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger disabled:opacity-40" onClick={() => setDeleteId(p.id)} disabled={p.schools_count > 0} title={p.schools_count > 0 ? 'Em uso por escolas' : 'Excluir'}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!editing}
        title={editing?.id ? 'Editar plano' : 'Novo plano'}
        onClose={() => !saving && setEditing(null)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving || !editing?.form.name.trim()}>
              {saving && <Loader2 size={16} className="animate-spin" />} Salvar
            </button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <label className="label">Nome do plano *</label>
              <input className="input" value={editing.form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ex.: Essencial" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Preço mensal (R$)</label>
                <input type="number" step="0.01" min="0" className="input" value={editing.form.monthly_price} onChange={(e) => patch({ monthly_price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Preço anual (R$)</label>
                <input type="number" step="0.01" min="0" className="input" value={editing.form.annual_price} onChange={(e) => patch({ annual_price: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Desconto anual (%)</label>
                <input type="number" step="0.1" min="0" max="100" className="input" value={editing.form.discount_percentage} onChange={(e) => patch({ discount_percentage: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Limite de alunos</label>
                <input type="number" min="0" className="input" placeholder="vazio = ilimitado"
                  value={editing.form.student_limit ?? ''}
                  onChange={(e) => patch({ student_limit: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="label">Recursos (um por linha)</label>
              <textarea className="input min-h-[90px]" value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} placeholder={'Chamada digital\nBoletim online\nCobrança PIX'} />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={editing.form.is_public} onChange={(e) => patch({ is_public: e.target.checked })} /> Público (aparece na landing)
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={editing.form.is_pilot} onChange={(e) => patch({ is_pilot: e.target.checked })} /> Piloto
              </label>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleteId}
        title="Excluir plano"
        onClose={() => setDeleteId(null)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setDeleteId(null)}>Cancelar</button>
            <button className="btn-danger" onClick={confirmDelete}>Excluir</button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.</p>
      </Modal>
    </>
  );
}
