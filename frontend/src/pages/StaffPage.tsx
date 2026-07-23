import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Users, Plus, Trash2, Pencil, Mail, Phone, Loader2, Copy, Check } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { staffService, type NewStaff, type CreatedStaff } from '@/services/staff';
import { createSchedule } from '@/services/schedules';
import { STAFF_ROLE_LABELS, type Staff, type StaffRole } from '@/types/models';

const ROLE_TONE: Record<StaffRole, 'primary' | 'success' | 'warning'> = {
  school_admin: 'primary',
  financial: 'success',
  teacher: 'primary',
  coordinator: 'warning',
};

const WEEKDAYS = [
  { wd: 0, label: 'Dom' },
  { wd: 1, label: 'Seg' },
  { wd: 2, label: 'Ter' },
  { wd: 3, label: 'Qua' },
  { wd: 4, label: 'Qui' },
  { wd: 5, label: 'Sex' },
  { wd: 6, label: 'Sáb' },
];

interface SlotState { enabled: boolean; start: string; end: string }

function defaultSlots(): SlotState[] {
  return WEEKDAYS.map(({ wd }) => ({
    enabled: wd >= 1 && wd <= 5, // Seg–Sex
    start: '08:00',
    end: '17:00',
  }));
}

interface FormFields extends NewStaff {}

export function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CreatedStaff | null>(null);
  const [copied, setCopied] = useState(false);
  const [slots, setSlots] = useState<SlotState[]>(defaultSlots());
  const [schedError, setSchedError] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormFields>();
  const watchRole = watch('role_type');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setStaff(await staffService.list()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setSlots(defaultSlots());
    setSchedError(null);
    reset({ name: '', cpf: '', email: '', phone: '', role_type: 'teacher', subject_teaches: '',
      position: '', admission_date: '', contract_type: undefined, weekly_hours: undefined, timeclock_enabled: true });
    setOpen(true);
  }

  function openEdit(s: Staff) {
    setEditing(s);
    reset({
      name: s.name, cpf: s.cpf ?? '', email: s.email, phone: s.phone ?? '',
      role_type: (s.role_type ?? s.role) as FormFields['role_type'],
      subject_teaches: s.subject_teaches ?? '',
      position: s.position ?? '',
      admission_date: s.admission_date ? s.admission_date.slice(0, 10) : '',
      contract_type: s.contract_type,
      weekly_hours: s.weekly_hours,
      timeclock_enabled: s.timeclock_enabled ?? true,
    });
    setOpen(true);
  }

  function closeModal() { reset(); setEditing(null); setSlots(defaultSlots()); setSchedError(null); setOpen(false); }

  function toggleDay(i: number) {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, enabled: !s.enabled } : s));
  }

  function updateSlot(i: number, field: 'start' | 'end', val: string) {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  async function onSubmit(data: FormFields) {
    // Valida jornada somente para novos cadastros
    if (!editing) {
      const activeDays = slots.filter((s) => s.enabled);
      if (activeDays.length === 0) {
        setSchedError('Selecione pelo menos um dia de trabalho.');
        return;
      }
      for (const slot of activeDays) {
        if (slot.start >= slot.end) {
          setSchedError('O horário de saída deve ser depois da entrada em todos os dias.');
          return;
        }
      }
      setSchedError(null);
    }

    setSaving(true);
    setError(null);
    try {
      const hours = data.weekly_hours != null && !Number.isNaN(Number(data.weekly_hours))
        ? Number(data.weekly_hours) : undefined;
      const payload = {
        ...data,
        subject_teaches: data.subject_teaches || undefined,
        position: data.position || undefined,
        admission_date: data.admission_date || undefined,
        contract_type: data.contract_type || undefined,
        weekly_hours: hours,
      };
      if (editing) {
        await staffService.update(editing.id, payload);
      } else {
        const created = await staffService.create(payload);
        // Salva a jornada de trabalho logo após criar o colaborador
        const userId = created.user_id;
        if (userId) {
          const activeDays = slots.filter((s) => s.enabled);
          await Promise.all(
            activeDays.map((s, i) =>
              createSchedule({
                user_id: userId,
                weekday: slots.indexOf(s),
                start_time: s.start,
                end_time: s.end,
              }).catch(() => {}) // falha silenciosa — jornada pode ser ajustada depois
            ),
          );
        }
        setCredentials(created);
      }
      await load();
      closeModal();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar funcionário');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    await staffService.remove(id);
    await load();
  }

  function copyCredentials() {
    if (!credentials) return;
    const text = `Funcionário: ${credentials.name}
Login (matrícula): ${credentials.registration_number}
Senha inicial: ${credentials.initial_password ?? '(temporária gerada no cadastro)'}
E-mail: ${credentials.email}
(troca de senha obrigatória no 1º acesso)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Funcionários"
        subtitle="Cadastre e gerencie a equipe da sua escola."
        actions={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Novo funcionário
          </button>
        }
      />

      {error && <div className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total" value={staff.length} icon={Users} tone="primary" />
        <MetricCard label="Professores" value={staff.filter((s) => (s.role_type ?? s.role) === 'teacher').length} icon={Users} tone="primary" />
        <MetricCard label="Ativos" value={staff.filter((s) => s.status === 'active').length} icon={Users} tone="success" />
      </div>

      <div className="card overflow-hidden">
        {staff.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum funcionário cadastrado"
            action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Novo funcionário</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Leciona</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const role = (s.role_type ?? s.role) as StaffRole;
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                            {s.name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                          </div>
                          <span className="font-medium text-ink">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted">{s.registration_number ?? '—'}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        <div className="flex items-center gap-1.5"><Mail size={13} /> {s.email}</div>
                        {s.phone && <div className="flex items-center gap-1.5 text-xs"><Phone size={12} /> {s.phone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={ROLE_TONE[role]}>{STAFF_ROLE_LABELS[role]}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-ink-muted text-xs">{s.subject_teaches ?? '—'}</td>
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
                          <button className="rounded-lg p-2 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => onRemove(s.id)} title="Remover">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        title={editing ? 'Editar funcionário' : 'Novo funcionário'}
        onClose={closeModal}
        footer={
          <>
            <button className="btn-outline" onClick={closeModal}>Cancelar</button>
            <button className="btn-primary" form="staff-form" type="submit" disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />} {editing ? 'Salvar' : 'Cadastrar'}
            </button>
          </>
        }
      >
        <form id="staff-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="label">Nome completo *</label>
            <input className="input" {...register('name', { required: 'Informe o nome' })} />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">CPF *</label>
              <input className="input" placeholder="000.000.000-00" {...register('cpf', { required: 'Informe o CPF' })} />
              {errors.cpf && <p className="mt-1 text-xs text-danger">{errors.cpf.message}</p>}
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" placeholder="(00) 00000-0000" {...register('phone')} />
            </div>
          </div>
          <div>
            <label className="label">E-mail *</label>
            <input type="email" className="input" {...register('email', { required: 'Informe o e-mail' })} />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Perfil *</label>
            <select className="input" {...register('role_type', { required: true })}>
              <option value="school_admin">Gestor/Admin</option>
              <option value="financial">Financeiro</option>
              <option value="teacher">Professor</option>
              <option value="coordinator">Coordenação</option>
            </select>
          </div>
          {watchRole === 'teacher' && (
            <div>
              <label className="label">Matéria / Ano que leciona</label>
              <input className="input" placeholder="Ex.: Matemática / 5º ano, ou Maternal" {...register('subject_teaches')} />
              <p className="mt-1 text-xs text-ink-muted">
                Para escolas infantis use o ano (ex.: "Maternal", "Pré I"). Para fundamental/médio use a matéria.
              </p>
            </div>
          )}

          {/* Dados trabalhistas */}
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-subtle">Dados trabalhistas</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Cargo</label>
                <input className="input" placeholder="Ex.: Professor(a) titular" {...register('position')} />
              </div>
              <div>
                <label className="label">Data de admissão</label>
                <input type="date" className="input" {...register('admission_date')} />
              </div>
              <div>
                <label className="label">Tipo de contrato</label>
                <select className="input" {...register('contract_type')}>
                  <option value="">—</option>
                  <option value="clt">CLT</option>
                  <option value="pj">PJ</option>
                  <option value="estagio">Estágio</option>
                  <option value="temporario">Temporário</option>
                </select>
              </div>
              <div>
                <label className="label">Carga horária semanal (h)</label>
                <input type="number" step="0.5" min="0" max="80" className="input" placeholder="Ex.: 40" {...register('weekly_hours', { valueAsNumber: true })} />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="h-4 w-4 rounded border-border" {...register('timeclock_enabled')} />
              Habilitado para bater ponto
            </label>
          </div>

          {/* Jornada de trabalho — apenas no cadastro */}
          {!editing && (
            <div className="border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-subtle">
                  Jornada de trabalho <span className="text-danger">*</span>
                </p>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setSlots(defaultSlots())}
                >
                  Seg–Sex 08:00–17:00
                </button>
              </div>

              <div className="space-y-2">
                {WEEKDAYS.map(({ wd, label }, i) => (
                  <div key={wd} className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                    slots[i].enabled ? 'border-primary/30 bg-primary-soft/20' : 'border-border bg-canvas'
                  }`}>
                    <label className="flex items-center gap-2 w-20 shrink-0 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={slots[i].enabled}
                        onChange={() => toggleDay(i)}
                      />
                      <span className={`text-sm font-semibold ${slots[i].enabled ? 'text-primary' : 'text-ink-muted'}`}>
                        {label}
                      </span>
                    </label>
                    {slots[i].enabled ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          className="input py-1 text-sm w-28"
                          value={slots[i].start}
                          onChange={(e) => updateSlot(i, 'start', e.target.value)}
                        />
                        <span className="text-xs text-ink-muted shrink-0">às</span>
                        <input
                          type="time"
                          className="input py-1 text-sm w-28"
                          value={slots[i].end}
                          onChange={(e) => updateSlot(i, 'end', e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-ink-subtle">Folga</span>
                    )}
                  </div>
                ))}
              </div>

              {schedError && <p className="mt-2 text-xs text-danger">{schedError}</p>}
            </div>
          )}

          {!editing && (
            <div className="rounded-xl border border-border bg-canvas p-3 text-xs text-ink-muted">
              Uma conta de acesso será criada automaticamente com uma senha temporária gerada pelo sistema. No primeiro acesso o sistema obrigará a troca por uma senha intransferível.
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={!!credentials}
        title="Funcionário cadastrado com sucesso!"
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
              <p className="font-semibold">Conta criada.</p>
              <p className="mt-1 text-xs">Anote ou envie estas credenciais ao funcionário.</p>
            </div>
            <div className="space-y-2 rounded-xl border border-border p-4">
              <div className="flex justify-between"><span className="text-ink-muted">Funcionário:</span><span className="font-medium text-ink">{credentials.name}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Login (matrícula):</span><span className="font-mono font-bold text-primary">{credentials.registration_number}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Senha inicial:</span><span className="font-mono font-bold text-ink">{credentials.initial_password ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">E-mail:</span><span className="font-medium text-ink">{credentials.email}</span></div>
              <p className="pt-1 text-xs text-ink-subtle">Senha temporária gerada automaticamente — anote e repasse ao funcionário. Troca obrigatória no 1º acesso.</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
