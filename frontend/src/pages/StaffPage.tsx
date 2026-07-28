import { useEffect, useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Users, Plus, Trash2, Pencil, Loader2, Copy, Check, Search, Link2,
  Briefcase, UserPlus, ShieldCheck, Eye, MoreVertical, Mail,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { SensitiveField } from '@/components/ui/SensitiveField';
import { staffService, type NewStaff, type CreatedStaff } from '@/services/staff';
import { createSchedule } from '@/services/schedules';
import { queryCache, CK, CACHE_TTL } from '@/lib/cache';
import { STAFF_ROLE_LABELS, CONTRACT_TYPE_LABELS, type Staff, type StaffRole } from '@/types/models';
import { useMe } from '@/auth/AuthGate';
import { staffCreateSchema } from '@/lib/schemas';
import { applyServerErrors } from '@/hooks/useFormErrors';
import { InviteBadge } from '@/components/ui/InviteBadge';

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
    <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink">{value || '—'}</span>
    </div>
  );
}

function KpiCard({
  icon: Icon, tone, label, value, hint,
}: {
  icon: typeof Users;
  tone: 'primary' | 'success' | 'warning' | 'danger';
  label: string;
  value: string;
  hint?: string;
}) {
  const toneCls: Record<typeof tone, { bg: string; text: string }> = {
    primary: { bg: 'bg-primary-soft', text: 'text-primary' },
    success: { bg: 'bg-success-soft', text: 'text-success' },
    warning: { bg: 'bg-warning-soft', text: 'text-warning' },
    danger:  { bg: 'bg-danger-soft',  text: 'text-danger'  },
  };
  const t = toneCls[tone];
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.bg} ${t.text}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-ink-muted">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-ink-subtle">{hint}</p>}
        </div>
      </div>
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
    enabled: wd >= 1 && wd <= 5,
    start: '08:00',
    end: '17:00',
  }));
}

interface FormFields extends NewStaff {}

/** Limpa valor mascarado antes de pré-popular formulário de edição. */
const unmasked = (v?: string) => (v?.includes('*') ? '' : (v ?? ''));

export function StaffPage() {
  const me = useMe();
  const canReveal = ['school_admin', 'financial', 'superadmin'].includes(me?.role ?? '');
  const uid = useId();
  const fId = (f: string) => `${uid}-${f}`;

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
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Staff | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // E-mail revelado do funcionário selecionado (para o botão copiar)
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null);

  // Envio/reenvio de convite de acesso (o funcionário define a própria senha)
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState<string | null>(null);

  async function sendStaffInvite(target: Staff) {
    setResetBusy(true);
    setResetError(null);
    setResetDone(null);
    try {
      const r = await staffService.sendInvite(target.id);
      setResetDone(r.emailed
        ? (r.wasResend ? 'Convite reenviado por e-mail.' : 'Convite enviado por e-mail.')
        : 'Convite registrado, mas o e-mail não pôde ser enviado agora.');
      await load();
    } catch (e: any) {
      setResetError(e?.message ?? 'Falha ao enviar o convite.');
    } finally {
      setResetBusy(false);
      setTimeout(() => setResetDone(null), 6000);
    }
  }

  const { register, handleSubmit, reset, watch, setError: setFieldError, formState: { errors } } = useForm<FormFields>({ resolver: zodResolver(staffCreateSchema) });
  const watchRole = watch('role_type');

  useEffect(() => { load(); }, []);

  async function load(force = false) {
    if (!force) {
      const cached = queryCache.get<Staff[]>(CK.staff, CACHE_TTL);
      if (cached) { setStaff(cached); setLoading(false); return; }
    }
    setLoading(true);
    try {
      const s = await staffService.list();
      queryCache.set(CK.staff, s);
      setStaff(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const counts = useMemo(() => ({
    all: staff.length,
    active: staff.filter((s) => s.status === 'active').length,
    inactive: staff.filter((s) => s.status === 'inactive').length,
    teachers: staff.filter((s) => (s.role_type ?? s.role) === 'teacher' && s.status === 'active').length,
    admin: staff.filter((s) => (s.role_type ?? s.role) !== 'teacher' && s.status === 'active').length,
  }), [staff]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .filter((s) => statusFilter === 'all' ? true : s.status === statusFilter)
      .filter((s) => !roleFilter || (s.role_type ?? s.role) === roleFilter)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.registration_number ?? '').includes(q));
  }, [staff, query, statusFilter, roleFilter]);

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
      name: s.name,
      cpf: unmasked(s.cpf),
      email: unmasked(s.email),
      phone: unmasked(s.phone),
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
              }).catch(() => {})
            ),
          );
        }
        setCredentials(created);
      }
      queryCache.invalidate(CK.staff);
      await load(true);
      closeModal();
    } catch (e: any) {
      if (!applyServerErrors(e, setFieldError)) {
        setError(e?.message ?? 'Erro ao salvar funcionário');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    await staffService.remove(id);
    queryCache.invalidate(CK.staff);
    await load(true);
  }

  function copyCredentials() {
    if (!credentials) return;
    const text =
      `Funcionário: ${credentials.name}\n` +
      `Login (e-mail): ${credentials.email}\n` +
      `Matrícula (alternativa): ${credentials.registration_number ?? '—'}\n` +
      `Acesso: o funcionário recebeu um convite por e-mail para criar a própria senha.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      {error && <div role="alert" className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

      {/* ===== HERO ===== */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EDE9FE] via-[#F3EEFF] to-[#F5F3FF] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Gestão de funcionários</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Cadastre, acompanhe e organize a equipe da sua escola em um só lugar.
            </p>
            <button
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-purple/90"
              onClick={openNew}
            >
              <Plus size={18} /> Novo colaborador
            </button>
          </div>
          <div className="hidden shrink-0 items-center justify-center sm:flex">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-purple/10 text-purple shadow-inner">
              <Briefcase size={64} />
            </div>
          </div>
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Users}
          tone="primary"
          label="Total de funcionários"
          value={counts.all.toString()}
          hint={counts.active + ' ativos · ' + counts.inactive + ' inativos'}
        />
        <KpiCard
          icon={UserPlus}
          tone="success"
          label="Professores"
          value={counts.teachers.toString()}
          hint="professores ativos"
        />
        <KpiCard
          icon={ShieldCheck}
          tone="warning"
          label="Equipe administrativa"
          value={counts.admin.toString()}
          hint="gestão, financeiro e coordenação"
        />
        <KpiCard
          icon={Briefcase}
          tone="danger"
          label="Inativos"
          value={counts.inactive.toString()}
          hint="funcionários inativos"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* ===== Coluna 70% — Lista ===== */}
        <div className="min-w-0 space-y-4">
          {/* Filtros (Perfil / Status / Busca) */}
          <div className="card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor={fId('filter-role')} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Perfil</label>
                <select id={fId('filter-role')} className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="">Todos os perfis</option>
                  <option value="school_admin">Gestor/Admin</option>
                  <option value="financial">Financeiro</option>
                  <option value="teacher">Professor</option>
                  <option value="coordinator">Coordenação</option>
                </select>
              </div>
              <div>
                <label htmlFor={fId('filter-status')} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Status</label>
                <select id={fId('filter-status')} className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                  <option value="all">Todos ({counts.all})</option>
                  <option value="active">Ativos ({counts.active})</option>
                  <option value="inactive">Inativos ({counts.inactive})</option>
                </select>
              </div>
              <div>
                <label htmlFor={fId('filter-query')} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Buscar</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                  <input id={fId('filter-query')} className="input pl-9" placeholder="Buscar funcionários…" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
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
                <table className="w-full text-sm" aria-label="Lista de funcionários">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                      <th className="px-4 py-3">Funcionário</th>
                      <th className="px-4 py-3">Matrícula</th>
                      <th className="px-4 py-3">Perfil</th>
                      <th className="px-4 py-3">Cargo</th>
                      <th className="px-4 py-3">Jornada</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const role = (s.role_type ?? s.role) as StaffRole;
                      return (
                        <tr
                          key={s.id}
                          onClick={() => { setSelected(s); setRevealedEmail(null); }}
                          className={`cursor-pointer border-b border-border last:border-0 hover:bg-canvas ${selected?.id === s.id ? 'bg-primary-soft/40' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                                {initials(s.name)}
                              </div>
                              <span className="truncate font-semibold text-ink">{s.name}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted">{s.registration_number ?? '—'}</td>
                          <td className="px-4 py-3">
                            <StatusBadge tone={ROLE_TONE[role]}>{STAFF_ROLE_LABELS[role]}</StatusBadge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{s.position ?? '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                            {s.weekly_hours != null ? `${s.weekly_hours}h/sem` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge tone={s.status === 'active' ? 'success' : 'neutral'}>
                              {s.status === 'active' ? 'Ativo' : 'Inativo'}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                className="rounded-lg p-2 text-ink-muted hover:bg-primary-soft hover:text-primary"
                                onClick={(e) => { e.stopPropagation(); setSelected(s); }}
                                aria-label={`Ver detalhes de ${s.name}`}
                              >
                                <Eye size={16} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink"
                                onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                                aria-label={`Editar ${s.name}`}
                              >
                                <MoreVertical size={16} aria-hidden="true" />
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
            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-ink-muted">
                <span>Mostrando {filtered.length} de {counts.all} funcionário(s).</span>
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
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
                    {initials(selected.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold text-ink">{selected.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span>Mat. <strong className="text-ink">{selected.registration_number ?? '—'}</strong></span>
                      {selected.position && <span>{selected.position}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge tone={ROLE_TONE[(selected.role_type ?? selected.role) as StaffRole]}>
                        {STAFF_ROLE_LABELS[(selected.role_type ?? selected.role) as StaffRole]}
                      </StatusBadge>
                      <StatusBadge tone={selected.status === 'active' ? 'success' : 'neutral'}>
                        {selected.status === 'active' ? 'Ativo' : 'Inativo'}
                      </StatusBadge>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button className="btn-outline flex items-center gap-1.5 text-xs" onClick={() => openEdit(selected)}>
                      <Pencil size={13} /> Editar
                    </button>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-subtle">Dados</p>
                <div className="space-y-2 text-sm">
                  <SensitiveField label="E-mail" maskedValue={selected.email}
                    entityType="staff" entityId={selected.id} field="email" canReveal={canReveal}
                    onReveal={(v) => setRevealedEmail(v)} />
                  <SensitiveField label="Telefone" maskedValue={selected.phone}
                    entityType="staff" entityId={selected.id} field="phone" canReveal={canReveal} />
                  <SensitiveField label="CPF" maskedValue={selected.cpf}
                    entityType="staff" entityId={selected.id} field="cpf" canReveal={canReveal} />
                  <Row label="Cargo" value={selected.position} />
                  <Row label="Leciona" value={selected.subject_teaches} />
                  <Row label="Admissão" value={selected.admission_date} />
                  <Row label="Contrato" value={selected.contract_type ? CONTRACT_TYPE_LABELS[selected.contract_type] ?? selected.contract_type : undefined} />
                  <Row label="Carga horária" value={selected.weekly_hours != null ? `${selected.weekly_hours}h/semana` : undefined} />
                </div>
              </div>

              <div className="card p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-ink">
                    <Link2 size={16} className="text-primary" /> Acesso do funcionário
                  </div>
                  <InviteBadge state={selected.invite_state} />
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Login (e-mail)" value={revealedEmail ?? selected.email} />
                  <Row label="Matrícula (alternativa)" value={selected.registration_number} />
                  <p className="mt-2 text-xs text-ink-muted">
                    O acesso é ativado pelo próprio funcionário através de um convite por e-mail (link individual,
                    de uso único, válido por 72 horas). A escola não define nem visualiza senhas.
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="btn-outline flex items-center gap-1.5 text-xs"
                    onClick={() => {
                      const emailVal = revealedEmail ?? selected.email;
                      const text =
                        `Funcionário: ${selected.name}\n` +
                        `Login (e-mail): ${emailVal}\n` +
                        `Matrícula (alternativa): ${selected.registration_number ?? '—'}\n` +
                        `Acesso: convite individual por e-mail para criar a própria senha.`;
                      navigator.clipboard.writeText(text);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />} {copiedLink ? 'Copiado!' : 'Copiar dados de login'}
                  </button>
                  <button
                    className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary-soft/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-soft disabled:opacity-60"
                    disabled={resetBusy}
                    onClick={() => sendStaffInvite(selected)}
                  >
                    {resetBusy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                    {selected.invite_state === 'activated' ? 'Enviar link de recuperação'
                      : selected.invite_state === 'pending' ? 'Reenviar convite'
                      : 'Enviar convite'}
                  </button>
                </div>
                {resetError && <p className="mt-2 text-xs text-danger">{resetError}</p>}
                {resetDone && <p className="mt-2 text-xs text-success">{resetDone}</p>}
              </div>

              <button
                className="w-full rounded-xl border border-danger/30 bg-danger-soft/30 p-3 text-xs font-semibold text-danger hover:bg-danger-soft/60"
                onClick={async () => {
                  if (!confirm(`Remover ${selected.name}? O funcionário ficará como inativo.`)) return;
                  await onRemove(selected.id);
                  setSelected(null);
                }}
              >
                <Trash2 size={14} className="mr-1.5 inline" /> Desativar funcionário
              </button>
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
            <label htmlFor={fId('name')} className="label">Nome completo *</label>
            <input id={fId('name')} className="input" autoComplete="name" maxLength={120} {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={fId('cpf')} className="label">CPF *</label>
              <input id={fId('cpf')} className="input" placeholder="000.000.000-00" inputMode="numeric" maxLength={14} autoComplete="off" {...register('cpf')} />
              {errors.cpf && <p className="mt-1 text-xs text-danger">{errors.cpf.message}</p>}
            </div>
            <div>
              <label htmlFor={fId('phone')} className="label">Telefone</label>
              <input id={fId('phone')} className="input" placeholder="(00) 00000-0000" inputMode="tel" maxLength={15} autoComplete="tel" {...register('phone')} />
            </div>
          </div>
          <div>
            <label htmlFor={fId('email')} className="label">E-mail {editing ? '' : '*'}</label>
            <input id={fId('email')} type="email" className="input"
              placeholder={editing ? 'Deixe em branco para manter o atual' : ''}
              autoComplete="email"
              maxLength={254}
              {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor={fId('role')} className="label">Perfil *</label>
            <select id={fId('role')} className="input" {...register('role_type')}>
              <option value="school_admin">Gestor/Admin</option>
              <option value="financial">Financeiro</option>
              <option value="teacher">Professor</option>
              <option value="coordinator">Coordenação</option>
            </select>
          </div>
          {watchRole === 'teacher' && (
            <div>
              <label htmlFor={fId('subject')} className="label">Matéria / Ano que leciona</label>
              <input id={fId('subject')} className="input" placeholder="Ex.: Matemática / 5º ano, ou Maternal" {...register('subject_teaches')} />
              <p className="mt-1 text-xs text-ink-muted">
                Para escolas infantis use o ano (ex.: "Maternal", "Pré I"). Para fundamental/médio use a matéria.
              </p>
            </div>
          )}

          <fieldset className="border-t border-border pt-4">
            <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-subtle">Dados trabalhistas</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={fId('position')} className="label">Cargo</label>
                <input id={fId('position')} className="input" placeholder="Ex.: Professor(a) titular" {...register('position')} />
              </div>
              <div>
                <label htmlFor={fId('admission')} className="label">Data de admissão</label>
                <input id={fId('admission')} type="date" className="input" {...register('admission_date')} />
              </div>
              <div>
                <label htmlFor={fId('contract')} className="label">Tipo de contrato</label>
                <select id={fId('contract')} className="input" {...register('contract_type')}>
                  <option value="">—</option>
                  <option value="clt">CLT</option>
                  <option value="pj">PJ</option>
                  <option value="estagio">Estágio</option>
                  <option value="temporario">Temporário</option>
                </select>
              </div>
              <div>
                <label htmlFor={fId('hours')} className="label">Carga horária semanal (h)</label>
                <input id={fId('hours')} type="number" step="0.5" min="0" max="80" className="input" placeholder="Ex.: 40" {...register('weekly_hours', { valueAsNumber: true })} />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="h-4 w-4 rounded border-border" {...register('timeclock_enabled')} />
              Habilitado para bater ponto
            </label>
          </fieldset>

          {!editing && (
            <fieldset className="border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between">
                <legend className="float-left text-xs font-bold uppercase tracking-wide text-ink-subtle">
                  Jornada de trabalho <span className="text-danger" aria-hidden="true">*</span>
                </legend>
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
                          aria-label={`Entrada de ${label}`}
                          className="input py-1 text-sm w-28"
                          value={slots[i].start}
                          onChange={(e) => updateSlot(i, 'start', e.target.value)}
                        />
                        <span className="text-xs text-ink-muted shrink-0" aria-hidden="true">às</span>
                        <input
                          type="time"
                          aria-label={`Saída de ${label}`}
                          className="input py-1 text-sm w-28"
                          value={slots[i].end}
                          onChange={(e) => updateSlot(i, 'end', e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-ink-subtle" aria-hidden="true">Folga</span>
                    )}
                  </div>
                ))}
              </div>

              {schedError && <p role="alert" className="mt-2 text-xs text-danger">{schedError}</p>}
            </fieldset>
          )}

          {!editing && (
            <div className="rounded-xl border border-border bg-canvas p-3 text-xs text-ink-muted">
              Uma conta de acesso será criada e um <b>convite individual</b> será enviado por e-mail ao funcionário,
              para que ele crie a própria senha (link de uso único, válido por 72 horas). A escola não define senhas.
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
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado!' : 'Copiar dados de login'}
            </button>
            <button className="btn-primary" onClick={() => setCredentials(null)}>Fechar</button>
          </>
        }
      >
        {credentials && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-success-soft p-4 text-success">
              <p className="font-semibold">Convite de acesso enviado.</p>
              <p className="mt-1 text-xs">
                {credentials.invite_emailed
                  ? `Enviamos um e-mail para ${credentials.email} com um link individual para criar a própria senha.`
                  : 'Cadastro concluído. Use "Reenviar convite" na ficha do funcionário para disparar o e-mail de acesso.'}
              </p>
            </div>
            <div className="space-y-2 rounded-xl border border-border p-4">
              <div className="flex justify-between"><span className="text-ink-muted">Funcionário:</span><span className="font-medium text-ink">{credentials.name}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Login (e-mail):</span><span className="font-medium text-primary">{credentials.email}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Matrícula (alternativa):</span><span className="font-mono text-ink-muted">{credentials.registration_number ?? '—'}</span></div>
              <p className="pt-1 text-xs text-ink-subtle">
                Nenhuma senha é definida pela escola. O funcionário cria uma senha pessoal e intransferível pelo link do convite.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
