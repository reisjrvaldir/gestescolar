import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CalendarDays, Plus, Trash2, Loader2, Check, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
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
      <PageHeader
        title="Ano Letivo / Calendário"
        subtitle="Gerencie feriados, provas, reuniões e eventos do calendário escolar."
        actions={
          <div className="flex items-center gap-2">
            <select className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {isAdmin && (
              <button className="btn-primary" onClick={() => setOpen(true)}>
                <Plus size={16} /> Novo evento
              </button>
            )}
          </div>
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

      <div className="mb-4 flex flex-wrap gap-1.5">
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

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-danger" /> Feriado</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Prova</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Reunião/Recesso</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Evento</span>
      </div>

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
