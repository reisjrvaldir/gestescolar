import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Users, Plus, Trash2, Pencil, Loader2, Copy, Check, Search, Link2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { staffService, type NewStaff, type CreatedStaff } from '@/services/staff';
import { createSchedule } from '@/services/schedules';
import { STAFF_ROLE_LABELS, type Staff, type StaffRole } from '@/types/models';

/** Senha inicial padrão para todos os funcionários novos (espelha o backend). */
const DEFAULT_STAFF_PASSWORD = 'Escola@2026';

type StatusFilter = 'all' | 'active' | 'inactive';

const ROLE_TONE: Record<StaffRole, 'primary' | 'success' | 'warning'> = {
  school_admin: 'primary',
  financial: 'success',
  teacher: 'primary',
  coordinator: 'warning',
};

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('');

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value || '—'}</span>
    </div>
  );
}

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Staff | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormFields>();
  const watchRole = watch('role_type');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setStaff(await staffService.list()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  const counts = useMemo(() => ({
    all: staff.length,
    active: staff.filter((s) => s.status === 'active').length,
    inactive: staff.filter((s) => s.status === 'inactive').length,
  }), [staff]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .filter((s) => statusFilter === 'all' ? true : s.status === statusFilter)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.registration_number ?? '').includes(q));
  }, [staff, query, statusFilter]);

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
            activeDays.map((s) =>
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
    const text =
      `Funcionário: ${credentials.name}\n` +
      `Login (e-mail): ${credentials.email}\n` +
      `Matrícula (alternativa): ${credentials.registration_number ?? '—'}\n` +
      `Senha inicial: ${credentials.initial_password ?? DEFAULT_STAFF_PASSWORD}\n` +
      `(troca de senha obrigatória no 1º acesso)`;
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* ===== Coluna 70% — Lista ===== */}
        <div className="min-w-0 space-y-4">
          {/* Abas Todos / Ativos / Inativos */}
          <div className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-card">
            {([
              { key: 'all', label: 'Funcionários', count: counts.all },
              { key: 'active', label: 'Ativos', count: counts.active },
              { key: 'inactive', label: 'Inativos', count: counts.inactive },
            ] as { key: StatusFilter; label: string; count: number }[]).map((t) => (
              <button
                key={t.key}
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  statusFilter === t.key ? 'bg-primary text-white' : 'text-ink-muted hover:bg-canvas hover:text-ink'
                }`}
                onClick={() => setStatusFilter(t.key)}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                  statusFilter === t.key ? 'bg-white/20 text-white' : 'bg-canvas text-ink-muted'
                }`}>{t.count}</span>
              </button>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border p-4">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <input className="input pl-9" placeholder="Buscar por nome ou matrícula…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <span className="text-sm text-ink-muted">{filtered.length} funcionário(s)</span>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={statusFilter === 'inactive' ? 'Nenhum funcionário inativo' : 'Nenhum funcionário encontrado'}
                description={statusFilter === 'inactive' ? 'Funcionários removidos aparecem aqui.' : 'Cadastre o primeiro funcionário para começar.'}
                action={statusFilter !== 'inactive'
                  ? <button className="btn-primary" onClick={openNew}><Plus size={16} /> Novo funcionário</button>
                  : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                      <th className="px-4 py-2.5">Nome</th>
                      <th className="px-4 py-2.5">Matrícula</th>
                      <th className="px-4 py-2.5">Perfil</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const role = (s.role_type ?? s.role) as StaffRole;
                      return (
                        <tr
                          key={s.id}
                          onClick={() => setSelected(s)}
                          className={`cursor-pointer border-b border-border last:border-0 hover:bg-canvas ${selected?.id === s.id ? 'bg-primary-soft/30' : ''}`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">
                                {initials(s.name)}
                              </div>
                              <span className="truncate font-medium text-ink">{s.name}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-muted">{s.registration_number ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge tone={ROLE_TONE[role]}>{STAFF_ROLE_LABELS[role]}</StatusBadge>
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge tone={s.status === 'active' ? 'success' : 'neutral'}>
                              {s.status === 'active' ? 'Ativo' : 'Inativo'}
                            </StatusBadge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ===== Coluna 30% — Detalhamento ===== */}
        <div className="space-y-4">
          {!selected ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center text-ink-muted">
              <Users size={32} className="mb-2 opacity-30" />
              <p className="text-sm">Selecione um funcionário na lista para ver os detalhes.</p>
            </div>
          ) : (
            <>
              <div className="card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
                    {initials(selected.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold text-ink">{selected.name}</h3>
                    <p className="text-xs text-ink-muted">Mat. <strong className="text-ink">{selected.registration_number ?? '—'}</strong></p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge tone={ROLE_TONE[(selected.role_type ?? selected.role) as StaffRole]}>
                        {STAFF_ROLE_LABELS[(selected.role_type ?? selected.role) as StaffRole]}
                      </StatusBadge>
                      <StatusBadge tone={selected.status === 'active' ? 'success' : 'neutral'}>
                        {selected.status === 'active' ? 'Ativo' : 'Inativo'}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="btn-outline flex flex-1 items-center justify-center gap-1.5 text-xs" onClick={() => openEdit(selected)}>
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    className="rounded-lg border border-border p-2 text-ink-muted hover:bg-danger-soft hover:text-danger"
                    onClick={async () => {
                      if (!confirm(`Remover ${selected.name}? O funcionário ficará como inativo.`)) return;
                      await onRemove(selected.id);
                      setSelected(null);
                    }}
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="card p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-subtle">Dados</p>
                <div className="space-y-2 text-sm">
                  <Row label="E-mail" value={selected.email} />
                  <Row label="Telefone" value={selected.phone} />
                  <Row label="CPF" value={selected.cpf} />
                  <Row label="Cargo" value={selected.position} />
                  <Row label="Leciona" value={selected.subject_teaches} />
                  <Row label="Admissão" value={selected.admission_date} />
                  <Row label="Contrato" value={selected.contract_type} />
                  <Row label="Carga horária" value={selected.weekly_hours != null ? `${selected.weekly_hours}h/semana` : undefined} />
                </div>
              </div>

              <div className="card p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                  <Link2 size={16} className="text-primary" /> Link de acesso do funcionário
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Login (e-mail)" value={selected.email} />
                  <Row label="Matrícula (alternativa)" value={selected.registration_number} />
                  <Row label="Senha inicial padrão" value={DEFAULT_STAFF_PASSWORD} />
                  <p className="mt-2 text-xs text-ink-muted">
                    Todos os funcionários recebem <b className="font-mono">{DEFAULT_STAFF_PASSWORD}</b> como senha inicial —
                    a troca é obrigatória no 1º acesso. Se já trocou, essa senha não vale mais.
                  </p>
                </div>
                <button
                  className="mt-3 btn-outline flex items-center gap-1.5 text-xs"
                  onClick={() => {
                    const text =
                      `Funcionário: ${selected.name}\n` +
                      `Login (e-mail): ${selected.email}\n` +
                      `Matrícula (alternativa): ${selected.registration_number ?? '—'}\n` +
                      `Senha inicial: ${DEFAULT_STAFF_PASSWORD}\n` +
                      `(troca obrigatória no 1º acesso)`;
                    navigator.clipboard.writeText(text);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />} {copiedLink ? 'Copiado!' : 'Copiar dados de acesso'}
                </button>
              </div>
            </>
          )}
        </div>
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
              Uma conta de acesso será criada automaticamente com a senha padrão da plataforma
              (<b className="font-mono">{DEFAULT_STAFF_PASSWORD}</b>). No primeiro acesso o sistema obrigará a troca por uma senha intransferível.
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
              <div className="flex justify-between"><span className="text-ink-muted">Login (e-mail):</span><span className="font-medium text-primary">{credentials.email}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Matrícula (alternativa):</span><span className="font-mono text-ink-muted">{credentials.registration_number ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Senha inicial:</span><span className="font-mono font-bold text-ink">{credentials.initial_password ?? DEFAULT_STAFF_PASSWORD}</span></div>
              <p className="pt-1 text-xs text-ink-subtle">
                Senha padrão da plataforma — <b className="font-mono">{DEFAULT_STAFF_PASSWORD}</b>. Troca obrigatória no 1º acesso.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
