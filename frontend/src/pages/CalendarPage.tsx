import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CalendarDays, Plus, Trash2, Loader2, Check, AlertTriangle, Calendar, School2, Clock } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { listEvents, createEvent, removeEvent, EVENT_TYPE_LABELS, type CalendarEvent, type EventType } from '@/services/calendar';
import { useMe } from '@/auth/AuthGate';
import { GuardianAgenda } from '@/components/calendar/GuardianAgenda';

const TYPE_TONE: Record<EventType, 'primary' | 'success' | 'warning' | 'danger'> = {
  holiday: 'danger',
  exam: 'warning',
  meeting: 'primary',
  event: 'success',
  recess: 'primary',
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const NATIONAL_HOLIDAYS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Sra. Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '12-25': 'Natal',
};

interface FormFields {
  title: string;
  date_start: string;
  date_end: string;
  event_type: EventType;
  description: string;
  start_time: string;
  end_time: string;
}

export function CalendarPage() {
  const me = useMe();
  // Responsável usa a Agenda dedicada (calendário 70/30).
  if (me?.role === 'guardian') return <GuardianAgenda />;
  const isAdmin = me && ['school_admin', 'superadmin'].includes(me.role);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormFields>();

  useEffect(() => { load(); }, [year]);

  async function load() {
    setLoading(true);
    try { setEvents(await listEvents(year)); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onCreate(data: FormFields) {
    try {
      await createEvent({
        ...data,
        date_end: data.date_end || undefined,
        start_time: data.start_time || undefined,
        end_time: data.end_time || undefined,
      });
      setToast({ type: 'success', msg: `Evento "${data.title}" criado` });
      await load();
      reset();
      setOpen(false);
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message ?? 'Erro ao criar evento' });
    }
  }

  async function onRemove(id: string, title: string) {
    try {
      await removeEvent(id);
      setToast({ type: 'success', msg: `Evento "${title}" removido` });
      await load();
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message ?? 'Erro ao remover evento' });
    }
  }

  const nationalForYear = Object.entries(NATIONAL_HOLIDAYS).map(([md, title]) => ({
    id: `nat-${md}`,
    title,
    date_start: `${year}-${md}`,
    date_end: undefined as string | undefined,
    event_type: 'holiday' as EventType,
    description: 'Feriado Nacional',
    start_time: undefined as string | undefined,
    end_time: undefined as string | undefined,
    created_at: '',
    isNational: true,
  }));

  const allEvents = [...events, ...nationalForYear.filter(
    (nh) => !events.some((e) => e.date_start === nh.date_start && e.event_type === 'holiday'),
  )].sort((a, b) => a.date_start.localeCompare(b.date_start));

  const filtered = month != null
    ? allEvents.filter((e) => {
        const m = new Date(e.date_start + 'T12:00:00').getMonth();
        return m === month;
      })
    : allEvents;

  const byMonth = filtered.reduce<Record<number, typeof allEvents>>((acc, e) => {
    const m = new Date(e.date_start + 'T12:00:00').getMonth();
    if (!acc[m]) acc[m] = [];
    acc[m].push(e);
    return acc;
  }, {});

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      {/* ===== HERO ===== */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-primary-soft to-primary-soft/40 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Ano Letivo</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Organize períodos, calendário, recessos e eventos do ano letivo da sua escola.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <select className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              {isAdmin && (
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary/90"
                  onClick={() => setOpen(true)}
                >
                  <Plus size={18} /> Novo evento
                </button>
              )}
            </div>
          </div>
          <div className="hidden shrink-0 items-center justify-center sm:flex">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-white/40 text-primary shadow-inner">
              <CalendarDays size={64} />
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
          toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ===== KPI CARDS ===== */}
      {(() => {
        const currentMonth = new Date().getMonth();
        const eventsThisMonth = allEvents.filter((e) => new Date(e.date_start + 'T12:00:00').getMonth() === currentMonth).length;
        const holidays = allEvents.filter((e) => e.event_type === 'holiday').length;
        const exams = allEvents.filter((e) => e.event_type === 'exam').length;
        const kpis: { label: string; value: string; hint: string; icon: typeof CalendarDays; tone: 'primary' | 'success' | 'warning' | 'danger' }[] = [
          { label: 'Ano letivo ativo', value: String(year), hint: `Calendário de ${year}`, icon: Calendar, tone: 'primary' },
          { label: 'Total de eventos', value: String(events.length), hint: `${events.length} evento(s) cadastrado(s)`, icon: School2, tone: 'success' },
          { label: 'Eventos do mês', value: String(eventsThisMonth), hint: MONTHS[currentMonth], icon: Clock, tone: 'warning' },
          { label: 'Feriados', value: String(holidays), hint: `${exams} prova(s) programada(s)`, icon: CalendarDays, tone: 'danger' },
        ];
        const bg: Record<string, string> = { primary: 'border-primary/20 bg-primary-soft/30', success: 'border-success/20 bg-success-soft/30', warning: 'border-warning/20 bg-warning-soft/30', danger: 'border-danger/20 bg-danger-soft/30' };
        const ico: Record<string, string> = { primary: 'bg-primary-soft text-primary', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger' };
        const txt: Record<string, string> = { primary: 'text-primary', success: 'text-success', warning: 'text-warning', danger: 'text-danger' };
        return (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className={`flex items-start gap-4 rounded-xl border p-5 ${bg[k.tone]}`}>
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ico[k.tone]}`}>
                  <k.icon size={20} />
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted">{k.label}</p>
                  <p className={`text-2xl font-extrabold ${txt[k.tone]}`}>{k.value}</p>
                  <p className="text-[11px] text-ink-subtle">{k.hint}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* ===== Coluna principal ===== */}
        <div className="min-w-0 space-y-4">
          {/* Filtro de meses */}
          <div className="card p-4">
            <div className="flex flex-wrap gap-1.5">
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${month == null ? 'bg-primary text-white' : 'bg-surface text-ink-muted hover:bg-canvas'}`}
                onClick={() => setMonth(null)}
              >Todos</button>
              {MONTHS.map((label, i) => (
                <button
                  key={i}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${month === i ? 'bg-primary text-white' : 'bg-surface text-ink-muted hover:bg-canvas'}`}
                  onClick={() => setMonth(i)}
                >{label.slice(0, 3)}</button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-danger" /> Feriado</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Prova</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Reunião/Recesso</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Evento</span>
            </div>
          </div>

          {/* Eventos */}
          {Object.keys(byMonth).length === 0 ? (
            <div className="card">
              <EmptyState
                icon={CalendarDays}
                title="Nenhum evento neste período"
                description={isAdmin ? 'Adicione feriados, provas e reuniões ao calendário.' : 'Nenhum evento cadastrado pela escola para este período.'}
                action={isAdmin ? <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Novo evento</button> : undefined}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(byMonth).sort(([a], [b]) => Number(a) - Number(b)).map(([m, items]) => (
                <div key={m} className="card overflow-hidden">
                  <div className="border-b border-border bg-canvas px-4 py-2.5">
                    <h3 className="text-sm font-bold text-ink">{MONTHS[Number(m)]} {year}</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {items.map((ev) => {
                      const isNat = 'isNational' in ev;
                      const dateStr = new Date(ev.date_start + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' });
                      return (
                        <div key={ev.id} className={`flex items-center gap-3 px-4 py-2.5 ${isNat ? 'bg-danger-soft/30' : 'hover:bg-canvas'}`}>
                          <span className="w-24 shrink-0 text-xs font-mono text-ink-muted">{dateStr}</span>
                          <StatusBadge tone={TYPE_TONE[ev.event_type]}>{EVENT_TYPE_LABELS[ev.event_type]}</StatusBadge>
                          <span className="min-w-0 flex-1 truncate font-medium text-ink">{ev.title}</span>
                          {ev.start_time && (
                            <span className="shrink-0 text-xs font-semibold text-ink-muted">
                              {ev.start_time}{ev.end_time ? `–${ev.end_time}` : ''}
                            </span>
                          )}
                          {ev.date_end && ev.date_end !== ev.date_start && (
                            <span className="text-xs text-ink-muted">até {new Date(ev.date_end + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                          )}
                          {ev.description && !isNat && <span className="hidden text-xs text-ink-muted sm:block">{ev.description}</span>}
                          {isNat && <span className="text-xs text-ink-subtle italic">Nacional</span>}
                          {isAdmin && !isNat && (
                            <button className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => onRemove(ev.id, ev.title)} title="Excluir">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== Sidebar ===== */}
        <div className="space-y-4">
          {/* Resumo do calendário */}
          <div className="card p-5">
            <p className="mb-3 text-sm font-bold text-ink">Resumo do calendário</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">Feriados</span><span className="font-semibold text-danger">{allEvents.filter(e => e.event_type === 'holiday').length} dias</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Provas</span><span className="font-semibold text-warning">{allEvents.filter(e => e.event_type === 'exam').length} eventos</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Reuniões</span><span className="font-semibold text-primary">{allEvents.filter(e => e.event_type === 'meeting').length} eventos</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Recessos</span><span className="font-semibold text-primary">{allEvents.filter(e => e.event_type === 'recess').length} períodos</span></div>
            </div>
          </div>

          {/* Ações rápidas */}
          {isAdmin && (
            <div className="card p-5">
              <p className="mb-3 text-sm font-bold text-ink">Ações rápidas</p>
              <div className="space-y-2">
                <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary-soft/40" onClick={() => setOpen(true)}>
                  <span className="flex items-center gap-2"><Plus size={16} /> Novo evento</span>
                  <span className="text-ink-subtle">→</span>
                </button>
              </div>
            </div>
          )}

          {/* Próximos eventos */}
          {(() => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const upcoming = allEvents.filter(e => e.date_start >= todayStr).slice(0, 5);
            if (upcoming.length === 0) return null;
            return (
              <div className="card p-5">
                <p className="mb-3 text-sm font-bold text-ink">Próximos eventos</p>
                <div className="space-y-3">
                  {upcoming.map((ev) => {
                    const d = new Date(ev.date_start + 'T12:00:00');
                    const day = String(d.getDate()).padStart(2, '0');
                    const mon = MONTHS[d.getMonth()].slice(0, 3).toUpperCase();
                    const toneCls = TYPE_TONE[ev.event_type];
                    const dotColor: Record<string, string> = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' };
                    return (
                      <div key={ev.id} className="flex items-start gap-3">
                        <div className="text-center">
                          <span className={`block text-lg font-extrabold ${toneCls === 'danger' ? 'text-danger' : toneCls === 'warning' ? 'text-warning' : toneCls === 'success' ? 'text-success' : 'text-primary'}`}>{day}</span>
                          <span className={`text-[10px] font-bold uppercase ${toneCls === 'danger' ? 'text-danger' : toneCls === 'warning' ? 'text-warning' : toneCls === 'success' ? 'text-success' : 'text-primary'}`}>{mon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor[toneCls]}`} />
                            {ev.title}
                          </p>
                          <p className="text-xs text-ink-muted">{EVENT_TYPE_LABELS[ev.event_type]}{ev.start_time ? ` · ${ev.start_time}` : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <Modal
        open={open}
        title="Novo evento"
        onClose={() => { reset(); setOpen(false); }}
        footer={
          <>
            <button className="btn-outline" onClick={() => { reset(); setOpen(false); }}>Cancelar</button>
            <button className="btn-primary" form="calendar-form" type="submit">Criar evento</button>
          </>
        }
      >
        <form id="calendar-form" className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div>
            <label className="label">Título *</label>
            <input className="input" placeholder="Ex.: Prova de Matemática — 3º Ano" {...register('title', { required: 'Informe o título' })} />
            {errors.title && <p className="mt-1 text-xs text-danger">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Data início *</label>
              <input type="date" className="input" {...register('date_start', { required: 'Informe a data' })} />
              {errors.date_start && <p className="mt-1 text-xs text-danger">{errors.date_start.message}</p>}
            </div>
            <div>
              <label className="label">Data fim</label>
              <input type="date" className="input" {...register('date_end')} />
              <p className="mt-1 text-xs text-ink-muted">Deixe vazio se for apenas 1 dia.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Horário início</label>
              <input type="time" className="input" {...register('start_time')} />
            </div>
            <div>
              <label className="label">Horário fim</label>
              <input type="time" className="input" {...register('end_time')} />
            </div>
          </div>
          <div>
            <label className="label">Tipo *</label>
            <select className="input" {...register('event_type', { required: 'Selecione o tipo' })}>
              {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Descrição</label>
            <input className="input" placeholder="Detalhes do evento (opcional)" {...register('description')} />
          </div>
        </form>
      </Modal>
    </>
  );
}
