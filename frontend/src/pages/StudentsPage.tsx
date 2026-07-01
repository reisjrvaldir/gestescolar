import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { GraduationCap, Plus, Search, Trash2, Pencil, Loader2, Copy, Check } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { studentsService, type NewStudent, type CreatedStudent } from '@/services/students';
import { classesService } from '@/services/classes';
import { schoolPlansService, type SchoolPlan } from '@/services/schoolPlans';
import type { SchoolClass, Student } from '@/types/models';
import { brl } from '@/lib/fees';

interface FormFields {
  name: string;
  cpf: string;
  birth_date: string;
  father_name: string;
  mother_name: string;
  class_id?: string;
  plan_id: string;
  guardian_name: string;
  guardian_email: string;
  guardian_cpf: string;
  guardian_phone?: string;
}

export function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [plans, setPlans] = useState<SchoolPlan[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<CreatedStudent | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, c, p] = await Promise.all([
        studentsService.list(),
        classesService.list(),
        schoolPlansService.list(),
      ]);
      setStudents(s);
      setClasses(c);
      setPlans(p);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar alunos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.registration_number ?? '').includes(q),
    );
  }, [students, query]);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormFields>();
  const selectedPlanId = watch('plan_id');
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  function openNew() {
    setEditing(null);
    reset({
      name: '', cpf: '', birth_date: '', father_name: '', mother_name: '',
      class_id: '', plan_id: '', guardian_name: '', guardian_email: '',
      guardian_cpf: '', guardian_phone: '',
    });
    setOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    reset({
      name: s.name,
      cpf: s.cpf ?? '',
      birth_date: s.birth_date ?? '',
      father_name: s.father_name ?? '',
      mother_name: s.mother_name ?? '',
      class_id: s.class_id ?? '',
      plan_id: s.plan_id ?? '',
      guardian_name: '', guardian_email: '', guardian_cpf: '', guardian_phone: '',
    });
    setOpen(true);
  }

  function closeModal() { reset(); setEditing(null); setOpen(false); }

  async function onSubmit(data: FormFields) {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await studentsService.update(editing.id, {
          name: data.name,
          cpf: data.cpf,
          birth_date: data.birth_date,
          father_name: data.father_name,
          mother_name: data.mother_name,
          class_id: data.class_id || undefined,
          plan_id: data.plan_id || undefined,
        });
      } else {
        const payload: NewStudent = {
          name: data.name,
          cpf: data.cpf,
          birth_date: data.birth_date,
          father_name: data.father_name,
          mother_name: data.mother_name,
          class_id: data.class_id || undefined,
          plan_id: data.plan_id,
          guardian: {
            name: data.guardian_name,
            email: data.guardian_email,
            cpf: data.guardian_cpf,
            phone: data.guardian_phone || undefined,
          },
        };
        const created = await studentsService.create(payload);
        setCredentials(created);
      }
      await load();
      closeModal();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar aluno');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    await studentsService.remove(id);
    await load();
  }

  function copyCredentials() {
    if (!credentials) return;
    const text = `Aluno: ${credentials.name}
Login (matrícula): ${credentials.registration_number}
Senha inicial: ${credentials.initial_password ?? '(6 primeiros dígitos do CPF do responsável)'}
E-mail do responsável: ${credentials.guardian_email}
(troca de senha obrigatória no 1º acesso)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const active = students.filter((s) => s.status === 'active');
  const noPlans = plans.length === 0;

  return (
    <>
      <PageHeader
        title="Alunos"
        subtitle="Gerencie os alunos da sua escola."
        actions={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Cadastrar aluno
          </button>
        }
      />

      {error && <div className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
      {noPlans && (
        <div className="mb-4 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
          Você precisa cadastrar pelo menos um <strong>plano de mensalidade</strong> em Configurações → Planos antes de cadastrar alunos.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total de alunos" value={students.length} icon={GraduationCap} tone="primary" />
        <MetricCard label="Ativos" value={active.length} icon={GraduationCap} tone="success" />
        <MetricCard label="Inativos" value={students.length - active.length} icon={GraduationCap} tone="warning" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input className="input pl-9" placeholder="Buscar por nome ou matrícula..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <span className="text-sm text-ink-muted">{filtered.length} aluno(s)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-ink-muted">
            <Loader2 className="animate-spin" size={18} /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Nenhum aluno encontrado"
            description="Cadastre o primeiro aluno para começar."
            action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Cadastrar aluno</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                  <th className="px-4 py-3">Aluno</th>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">Turma</th>
                  <th className="px-4 py-3">Mensalidade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                          {s.name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                        </div>
                        <span className="font-medium text-ink">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-muted">{s.registration_number ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{s.class_name ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{s.monthly_fee != null ? brl(Number(s.monthly_fee)) : '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={s.status === 'active' ? 'success' : 'neutral'}>
                        {s.status === 'active' ? 'Ativo' : 'Inativo'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button className="rounded-lg p-2 text-ink-muted hover:bg-primary-soft hover:text-primary" onClick={() => openEdit(s)} title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button className="rounded-lg p-2 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => onRemove(s.id)} title="Inativar">
                          <Trash2 size={15} />
                        </button>
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
        open={open}
        title={editing ? 'Editar aluno' : 'Cadastrar aluno'}
        onClose={closeModal}
        footer={
          <>
            <button className="btn-outline" onClick={closeModal}>Cancelar</button>
            <button className="btn-primary" form="student-form" type="submit" disabled={saving || noPlans}>
              {saving && <Loader2 size={16} className="animate-spin" />} {editing ? 'Salvar' : 'Cadastrar'}
            </button>
          </>
        }
      >
        <form id="student-form" className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-subtle">Dados do aluno</h4>
            <div className="space-y-3">
              <div>
                <label className="label">Nome completo *</label>
                <input className="input" {...register('name', { required: 'Informe o nome' })} />
                {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">CPF *</label>
                  <input className="input" placeholder="000.000.000-00" {...register('cpf', { required: 'Informe o CPF' })} />
                  {errors.cpf && <p className="mt-1 text-xs text-danger">{errors.cpf.message}</p>}
                </div>
                <div>
                  <label className="label">Data de nascimento *</label>
                  <input type="date" className="input" {...register('birth_date', { required: 'Informe a data' })} />
                  {errors.birth_date && <p className="mt-1 text-xs text-danger">{errors.birth_date.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Nome do pai *</label>
                  <input className="input" {...register('father_name', { required: 'Informe o nome do pai' })} />
                  {errors.father_name && <p className="mt-1 text-xs text-danger">{errors.father_name.message}</p>}
                </div>
                <div>
                  <label className="label">Nome da mãe *</label>
                  <input className="input" {...register('mother_name', { required: 'Informe o nome da mãe' })} />
                  {errors.mother_name && <p className="mt-1 text-xs text-danger">{errors.mother_name.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Turma</label>
                  <select className="input" {...register('class_id')}>
                    <option value="">— Sem turma —</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Plano (mensalidade) *</label>
                  <select className="input" {...register('plan_id', { required: 'Selecione um plano' })} disabled={noPlans}>
                    <option value="">Selecione…</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(Number(p.monthly_fee))}</option>)}
                  </select>
                  {errors.plan_id && <p className="mt-1 text-xs text-danger">{errors.plan_id.message}</p>}
                  {selectedPlan && (
                    <p className="mt-1 text-xs text-ink-muted">Mensalidade: <strong>{brl(Number(selectedPlan.monthly_fee))}</strong></p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {!editing && (
            <div className="border-t border-border pt-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-subtle">
                Responsável (login)
              </h4>
              <p className="mb-3 text-xs text-ink-muted">
                Uma conta de acesso será criada automaticamente para o responsável acompanhar o aluno.
                Uma senha temporária será gerada automaticamente. No primeiro acesso o sistema obrigará a troca por uma senha intransferível.
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Nome do responsável *</label>
                    <input className="input" {...register('guardian_name', { required: 'Informe o nome' })} />
                    {errors.guardian_name && <p className="mt-1 text-xs text-danger">{errors.guardian_name.message}</p>}
                  </div>
                  <div>
                    <label className="label">CPF do responsável *</label>
                    <input className="input" placeholder="000.000.000-00" {...register('guardian_cpf', { required: 'Informe o CPF' })} />
                    {errors.guardian_cpf && <p className="mt-1 text-xs text-danger">{errors.guardian_cpf.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Email *</label>
                    <input type="email" className="input" {...register('guardian_email', { required: 'Informe o email' })} />
                    {errors.guardian_email && <p className="mt-1 text-xs text-danger">{errors.guardian_email.message}</p>}
                  </div>
                  <div>
                    <label className="label">Telefone</label>
                    <input className="input" placeholder="(00) 00000-0000" {...register('guardian_phone')} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={!!credentials}
        title="Aluno cadastrado com sucesso!"
        onClose={() => setCredentials(null)}
        footer={
          <>
            <button className="btn-outline" onClick={copyCredentials}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado!' : 'Copiar dados'}
            </button>
            <button className="btn-primary" onClick={() => setCredentials(null)}>Fechar</button>
          </>
        }
      >
        {credentials && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-success-soft p-4 text-success">
              <p className="font-semibold">Conta do responsável criada.</p>
              <p className="mt-1 text-xs">Anote ou envie estas credenciais ao responsável.</p>
            </div>
            <div className="space-y-2 rounded-xl border border-border p-4">
              <div className="flex justify-between"><span className="text-ink-muted">Aluno:</span><span className="font-medium text-ink">{credentials.name}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Login (matrícula):</span><span className="font-mono font-bold text-primary">{credentials.registration_number}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Senha inicial:</span><span className="font-mono font-bold text-ink">{credentials.initial_password ?? '—'}</span></div>
              {credentials.monthly_fee != null && (
                <div className="flex justify-between"><span className="text-ink-muted">Mensalidade:</span><span className="font-bold text-ink">{brl(Number(credentials.monthly_fee))}</span></div>
              )}
              <div className="flex justify-between"><span className="text-ink-muted">E-mail do responsável:</span><span className="font-medium text-ink">{credentials.guardian_email}</span></div>
              <p className="pt-1 text-xs text-ink-subtle">Senha = 6 primeiros dígitos do CPF do responsável. Troca obrigatória no 1º acesso.</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
