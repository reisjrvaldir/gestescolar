import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ClipboardList, Plus, Trash2, Loader2, Check, AlertTriangle, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { listSchedules, createSchedule, removeSchedule, WEEKDAY_LABELS, type Schedule } from '@/services/schedules';
import { api } from '@/lib/api';
import { useMe } from '@/auth/AuthGate';

interface StaffOption { id: string; name: string; user_id?: string }

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function calcWeeklyHours(items: Schedule[]): string {
  let total = 0;
  for (const s of items) {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    total += (eh * 60 + em - sh * 60 - sm) / 60;
  }
  return `${total.toFixed(0)}h`;
}

// ==================== VISÃO COLABORADOR (somente leitura) ====================
function MyJourneyView({ profileId }: { profileId: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSchedules(profileId)
      .then(setSchedules)
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, [profileId]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /><span className="ml-2">Carregando…</span></div>;
  }

  const sorted = [...schedules].sort((a, b) => a.weekday - b.weekday);
  const weeklyHours = calcWeeklyHours(sorted);

  return (
    <>
      <PageHeader
        title="Minha Jornada"
        subtitle="Horários de trabalho cadastrados pela gestão para você."
      />

      {schedules.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title="Sem jornada cadastrada"
            description="A gestão ainda não definiu sua jornada de trabalho. Fale com a coordenação."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-canvas px-4 py-3">
            <h3 className="text-sm font-bold text-ink">Jornada semanal</h3>
            <span className="text-xs text-ink-muted">{weeklyHours}/semana — {sorted.length} dia(s)</span>
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {WEEKDAY_SHORT.map((day, i) => {
              const slot = sorted.find((s) => s.weekday === i);
              return (
                <div key={i} className={`flex flex-col items-center rounded-xl border px-3 py-2 text-center min-w-[72px] ${
                  slot ? 'border-primary bg-primary-soft/30' : 'border-border bg-canvas'
                }`}>
                  <span className={`text-xs font-bold ${slot ? 'text-primary' : 'text-ink-subtle'}`}>{day}</span>
                  {slot ? (
                    <>
                      <span className="mt-1 text-xs font-mono text-ink">{slot.start_time.slice(0, 5)}</span>
                      <span className="text-[10px] text-ink-muted">às</span>
                      <span className="text-xs font-mono text-ink">{slot.end_time.slice(0, 5)}</span>
                    </>
                  ) : (
                    <span className="mt-1 text-[10px] text-ink-subtle">Folga</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ==================== VISÃO GESTÃO ====================
export function JourneysPage() {
  const me = useMe();
  const isAdmin = !!me && ['school_admin', 'superadmin'].includes(me.role);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    user_id: string; weekday: string; start_time: string; end_time: string;
  }>();

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin]);

  async function load() {
    setLoading(true);
    try {
      setSchedules(await listSchedules());
      const r = await api.get<{ data: StaffOption[] }>('/staff');
      setStaffList(r.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onCreate(data: { user_id: string; weekday: string; start_time: string; end_time: string }) {
    try {
      await createSchedule({
        user_id: data.user_id,
        weekday: Number(data.weekday),
        start_time: data.start_time,
        end_time: data.end_time,
      });
      const staffName = staffList.find((s) => s.id === data.user_id)?.name ?? '';
      setToast({ type: 'success', msg: `Jornada de ${WEEKDAY_LABELS[Number(data.weekday)]} criada para ${staffName}` });
      await load();
      reset();
      setOpen(false);
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message ?? 'Erro ao criar jornada' });
    }
  }

  async function onRemove(id: string) {
    try {
      await removeSchedule(id);
      setToast({ type: 'success', msg: 'Jornada removida' });
      await load();
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message ?? 'Erro ao remover jornada' });
    }
  }

  // Colaborador/professor vê somente a própria jornada
  if (!isAdmin && me) {
    return <MyJourneyView profileId={me.profile_id} />;
  }

  const grouped = schedules.reduce<Record<string, Schedule[]>>((acc, s) => {
    const name = s.user_name ?? 'Sem nome';
    if (!acc[name]) acc[name] = [];
    acc[name].push(s);
    return acc;
  }, {});

  const staffWithJourney = Object.keys(grouped).length;
  const totalSlots = schedules.length;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Jornadas de Trabalho"
        subtitle="Defina os horários de trabalho de cada colaborador."
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Nova jornada
          </button>
        }
      />

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
          toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Colaboradores com jornada" value={String(staffWithJourney)} icon={ClipboardList} tone="primary" />
        <MetricCard label="Total de horários" value={String(totalSlots)} icon={Clock} tone="success" />
        <MetricCard label="Sem jornada" value={String(Math.max(0, staffList.length - staffWithJourney))} icon={ClipboardList} tone="warning" />
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma jornada cadastrada"
            description="Defina os horários de trabalho da equipe para que possam registrar o ponto."
            action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nova jornada</button>}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => {
            const sorted = [...items].sort((a, b) => a.weekday - b.weekday);
            const weeklyHours = calcWeeklyHours(sorted);
            return (
              <div key={name} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-canvas px-4 py-3">
                  <h3 className="text-sm font-bold text-ink">{name}</h3>
                  <span className="text-xs text-ink-muted">{weeklyHours}/semana — {sorted.length} dia(s)</span>
                </div>
                <div className="flex flex-wrap gap-2 p-4">
                  {WEEKDAY_SHORT.map((day, i) => {
                    const slot = sorted.find((s) => s.weekday === i);
                    return (
                      <div key={i} className={`flex flex-col items-center rounded-xl border px-3 py-2 text-center ${
                        slot ? 'border-primary bg-primary-soft/30' : 'border-border bg-canvas'
                      }`}>
                        <span className={`text-xs font-bold ${slot ? 'text-primary' : 'text-ink-subtle'}`}>{day}</span>
                        {slot ? (
                          <>
                            <span className="mt-1 text-xs font-mono text-ink">{slot.start_time}</span>
                            <span className="text-[10px] text-ink-muted">às</span>
                            <span className="text-xs font-mono text-ink">{slot.end_time}</span>
                            <button
                              className="mt-1 rounded p-0.5 text-ink-subtle hover:text-danger"
                              onClick={() => onRemove(slot.id)}
                              title="Remover"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        ) : (
                          <span className="mt-1 text-[10px] text-ink-subtle">Folga</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        title="Nova jornada"
        onClose={() => { reset(); setOpen(false); }}
        footer={
          <>
            <button className="btn-outline" onClick={() => { reset(); setOpen(false); }}>Cancelar</button>
            <button className="btn-primary" form="journey-form" type="submit">Salvar</button>
          </>
        }
      >
        <form id="journey-form" className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div>
            <label className="label">Colaborador *</label>
            <select className="input" {...register('user_id', { required: 'Selecione o colaborador' })}>
              <option value="">Selecione…</option>
              {staffList.map((s) => <option key={s.id} value={s.user_id ?? s.id}>{s.name}</option>)}
            </select>
            {errors.user_id && <p className="mt-1 text-xs text-danger">{errors.user_id.message}</p>}
          </div>
          <div>
            <label className="label">Dia da semana *</label>
            <select className="input" {...register('weekday', { required: 'Selecione o dia' })}>
              {WEEKDAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Entrada *</label>
              <input type="time" className="input" {...register('start_time', { required: 'Informe o horário' })} />
              {errors.start_time && <p className="mt-1 text-xs text-danger">{errors.start_time.message}</p>}
            </div>
            <div>
              <label className="label">Saída *</label>
              <input type="time" className="input" {...register('end_time', { required: 'Informe o horário' })} />
              {errors.end_time && <p className="mt-1 text-xs text-danger">{errors.end_time.message}</p>}
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
