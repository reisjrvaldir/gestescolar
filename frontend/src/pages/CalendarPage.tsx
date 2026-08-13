import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  CalendarDays, Plus, Trash2, Loader2, Check, AlertTriangle,
  ChevronLeft, ChevronRight, Calendar, School2, Clock, X, Pencil, Copy,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { listEvents, createEvent, updateEvent, removeEvent, EVENT_TYPE_LABELS, type CalendarEvent, type EventType } from '@/services/calendar';
import { classesService } from '@/services/classes';
import type { SchoolClass } from '@/types/models';
import { useMe } from '@/auth/AuthGate';
import { GuardianAgenda } from '@/components/calendar/GuardianAgenda';

const TYPE_TONE: Record<EventType, string> = {
  holiday: 'bg-danger text-white',
  exam: 'bg-warning text-white',
  meeting: 'bg-primary text-white',
  event: 'bg-success text-white',
  recess: 'bg-primary/70 text-white',
};
const TYPE_DOT: Record<EventType, string> = {
  holiday: 'bg-danger',
  exam: 'bg-warning',
  meeting: 'bg-primary',
  event: 'bg-success',
  recess: 'bg-primary/70',
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
  class_id: string;
}

function buildGrid(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: { day: number; offset: number }[] = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ day: prevDays - i, offset: -1 });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, offset: 0 });
  while (cells.length < 42) cells.push({ day: cells.length - firstDow - daysInMonth + 1, offset: 1 });
  return cells;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function CalendarPage() {
  const me = useMe();
  if (me?.role === 'guardian') return <GuardianAgenda />;
  const isAdmin = !!(me && ['school_admin', 'superadmin'].includes(me.role));
  return <CalendarView isAdmin={isAdmin} />;
}

function CalendarView({ isAdmin }: { isAdmin: boolean }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  // Se editingId estiver setado → modal está no modo edição; senão é criação.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarEvent[]>([]);
  const [selectedDayLabel, setSelectedDayLabel] = useState('');
  const [dayOpen, setDayOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormFields>();

  useEffect(() => { load(); }, [calYear]);
  useEffect(() => { if (isAdmin) classesService.list().then(setClasses).catch(() => {}); }, []);

  async function load() {
    setLoading(true);
    try { setEvents(await listEvents(calYear)); } catch (e) { console.error(e); }
    setLoading(false);
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  async function onSave(data: FormFields) {
    try {
      const payload = {
        ...data,
        date_end: data.date_end || undefined,
        start_time: data.start_time || undefined,
        end_time: data.end_time || undefined,
        class_id: data.class_id || undefined,
      };
      if (editingId) {
        await updateEvent(editingId, payload);
        setToast({ type: 'success', msg: `Evento "${data.title}" atualizado` });
      } else {
        await createEvent(payload);
        setToast({ type: 'success', msg: `Evento "${data.title}" criado` });
      }
      await load();
      reset();
      setEditingId(null);
      setOpen(false);
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message ?? 'Erro ao salvar evento' });
    }
  }

  async function onRemove(id: string, title: string) {
    try {
      await removeEvent(id);
      setToast({ type: 'success', msg: `Evento "${title}" removido` });
      setDayOpen(false);
      await load();
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message ?? 'Erro ao remover evento' });
    }
  }

  function openCreate(dateStr?: string) {
    reset();
    setEditingId(null);
    if (dateStr) setValue('date_start', dateStr);
    setOpen(true);
  }

  // Abre o modal já preenchido com os dados do evento existente.
  //  - modo "edit"  → salva por cima (PUT)
  //  - modo "copy"  → limpa o id e a data, para virar um evento novo em outro dia
  function openEditOrCopy(ev: CalendarEvent, mode: 'edit' | 'copy') {
    reset({
      title: ev.title,
      description: ev.description ?? '',
      date_start: mode === 'copy' ? '' : ev.date_start,
      date_end: mode === 'copy' ? '' : (ev.date_end ?? ''),
      event_type: ev.event_type,
      start_time: ev.start_time ?? '',
      end_time: ev.end_time ?? '',
      class_id: ev.class_id ?? '',
    });
    setEditingId(mode === 'edit' ? ev.id : null);
    setDayOpen(false);
    setOpen(true);
  }

  function openDay(year: number, month: number, day: number) {
    const dateStr = isoDate(year, month, day);
    const dayEvts = allEvents.filter(e => e.date_start === dateStr);
    setSelectedDay(dayEvts);
    setSelectedDayLabel(`${String(day).padStart(2, '0')} de ${MONTHS[month]} de ${year}`);
    setDayOpen(true);
  }

  const nationalForYear = Object.entries(NATIONAL_HOLIDAYS).map(([md, title]) => ({
    id: `nat-${md}`,
    title,
    date_start: `${calYear}-${md}`,
    date_end: undefined as string | undefined,
    event_type: 'holiday' as EventType,
    description: 'Feriado Nacional',
    start_time: null as string | null,
    end_time: null as string | null,
    class_id: null,
    class_name: null,
    created_at: '',
    isNational: true,
  }));

  const allEvents = [...events, ...nationalForYear.filter(
    nh => !events.some(e => e.date_start === nh.date_start && e.event_type === 'holiday'),
  )].sort((a, b) => a.date_start.localeCompare(b.date_start));

  const eventsThisMonth = allEvents.filter(e => {
    const d = new Date(e.date_start + 'T12:00:00');
    return d.getFullYear() === calYear && d.getMonth() === calMonth;
  });

  const eventsMap: Record<string, CalendarEvent[]> = {};
  for (const ev of allEvents) {
    if (!eventsMap[ev.date_start]) eventsMap[ev.date_start] = [];
    eventsMap[ev.date_start].push(ev);
  }

  const grid = buildGrid(calYear, calMonth);
  const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const kpis = [
    { label: 'Ano letivo', value: String(calYear), hint: `Navegando ${MONTHS[calMonth]}`, icon: Calendar, tone: 'primary' as const },
    { label: 'Total de eventos', value: String(events.length), hint: 'eventos cadastrados', icon: School2, tone: 'success' as const },
    { label: 'Este mês', value: String(eventsThisMonth.length), hint: MONTHS[calMonth], icon: Clock, tone: 'warning' as const },
    { label: 'Feriados', value: String(allEvents.filter(e => e.event_type === 'holiday').length), hint: 'no calendário', icon: CalendarDays, tone: 'danger' as const },
  ];
  const bg: Record<string, string> = { primary: 'border-primary/20 bg-primary-soft/30', success: 'border-success/20 bg-success-soft/30', warning: 'border-warning/20 bg-warning-soft/30', danger: 'border-danger/20 bg-danger-soft/30' };
  const ico: Record<string, string> = { primary: 'bg-primary-soft text-primary', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger' };
  const txt: Record<string, string> = { primary: 'text-primary', success: 'text-success', warning: 'text-warning', danger: 'text-danger' };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /><span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      {/* HERO */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EDE9FE] via-[#F3EEFF] to-[#F5F3FF] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Ano Letivo</h1>
            <p className="mt-2 text-sm text-ink-muted">Organize períodos, calendário, recessos e eventos do ano letivo.</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <select
                className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink"
                value={calYear}
                onChange={e => { setCalYear(Number(e.target.value)); setCalMonth(new Date().getMonth()); }}
              >
                {[calYear - 1, calYear, calYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {isAdmin && (
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-purple/90"
                  onClick={() => openCreate()}
                >
                  <Plus size={18} /> Novo evento
                </button>
              )}
            </div>
          </div>
          <div className="hidden shrink-0 items-center justify-center sm:flex">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-purple/10 text-purple shadow-inner">
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
          <button className="ml-auto" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(k => (
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* CALENDÁRIO */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            {/* Navegação do mês */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <button
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink"
                onClick={prevMonth}
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="text-base font-bold text-ink">
                {MONTHS[calMonth]} {calYear}
              </h2>
              <button
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink"
                onClick={nextMonth}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Cabeçalho dias da semana */}
            <div className="grid grid-cols-7 border-b border-border">
              {WEEK_DAYS.map(d => (
                <div key={d} className="py-2 text-center text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                  {d}
                </div>
              ))}
            </div>

            {/* Grade de dias */}
            <div className="grid grid-cols-7">
              {grid.map((cell, idx) => {
                const isCurrentMonth = cell.offset === 0;
                const effectiveMonth = calMonth + cell.offset;
                const effectiveYear = calYear + (effectiveMonth < 0 ? -1 : effectiveMonth > 11 ? 1 : 0);
                const normalizedMonth = ((effectiveMonth % 12) + 12) % 12;
                const dateStr = isoDate(effectiveYear, normalizedMonth, cell.day);
                const dayEvents = eventsMap[dateStr] ?? [];
                const isToday = dateStr === todayStr;
                const isLastRow = idx >= 35;
                const isLastCol = idx % 7 === 6;

                return (
                  <div
                    key={idx}
                    className={`
                      min-h-[80px] cursor-pointer p-1.5
                      ${!isLastRow ? 'border-b border-border' : ''}
                      ${!isLastCol ? 'border-r border-border' : ''}
                      ${isCurrentMonth ? 'bg-surface hover:bg-canvas' : 'bg-canvas/50'}
                    `}
                    onClick={() => {
                      if (dayEvents.length > 0) {
                        openDay(effectiveYear, normalizedMonth, cell.day);
                      } else if (isAdmin && isCurrentMonth) {
                        openCreate(dateStr);
                      }
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`
                        inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold
                        ${isToday ? 'bg-primary text-white' : isCurrentMonth ? 'text-ink' : 'text-ink-muted/50'}
                      `}>
                        {cell.day}
                      </span>
                      {isAdmin && isCurrentMonth && dayEvents.length === 0 && (
                        <Plus size={12} className="text-ink-muted/30 opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div
                          key={ev.id}
                          className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${TYPE_TONE[ev.event_type]}`}
                          title={ev.title}
                        >
                          <span className="truncate">{ev.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="px-1 text-[10px] text-ink-muted">+{dayEvents.length - 3} mais</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-3 border-t border-border px-4 py-3 text-xs text-ink-muted">
              {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([type, label]) => (
                <span key={type} className="flex items-center gap-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${TYPE_DOT[type]}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4">
          {/* Resumo */}
          <div className="card p-5">
            <p className="mb-3 text-sm font-bold text-ink">Resumo do calendário</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">Feriados</span><span className="font-semibold text-danger">{allEvents.filter(e => e.event_type === 'holiday').length}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Provas</span><span className="font-semibold text-warning">{allEvents.filter(e => e.event_type === 'exam').length}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Reuniões</span><span className="font-semibold text-primary">{allEvents.filter(e => e.event_type === 'meeting').length}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Recessos</span><span className="font-semibold text-primary">{allEvents.filter(e => e.event_type === 'recess').length}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Eventos</span><span className="font-semibold text-success">{allEvents.filter(e => e.event_type === 'event').length}</span></div>
            </div>
          </div>

          {isAdmin && (
            <div className="card p-5">
              <p className="mb-3 text-sm font-bold text-ink">Ações rápidas</p>
              <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary-soft/40" onClick={() => openCreate()}>
                <span className="flex items-center gap-2"><Plus size={16} /> Novo evento</span>
                <span className="text-ink-subtle">→</span>
              </button>
            </div>
          )}

          {/* Próximos eventos */}
          {(() => {
            const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
            const upcoming = allEvents.filter(e => e.date_start >= todayIso).slice(0, 5);
            if (!upcoming.length) return null;
            return (
              <div className="card p-5">
                <p className="mb-3 text-sm font-bold text-ink">Próximos eventos</p>
                <div className="space-y-3">
                  {upcoming.map(ev => {
                    const d = new Date(ev.date_start + 'T12:00:00');
                    const day = String(d.getDate()).padStart(2, '0');
                    const mon = MONTHS[d.getMonth()].slice(0, 3).toUpperCase();
                    const dotCls = TYPE_DOT[ev.event_type];
                    const numCls = { holiday: 'text-danger', exam: 'text-warning', meeting: 'text-primary', event: 'text-success', recess: 'text-primary' }[ev.event_type];
                    return (
                      <div key={ev.id} className="flex items-start gap-3">
                        <div className="text-center">
                          <span className={`block text-lg font-extrabold ${numCls}`}>{day}</span>
                          <span className={`text-[10px] font-bold uppercase ${numCls}`}>{mon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls}`} />
                            {ev.title}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {EVENT_TYPE_LABELS[ev.event_type]}
                            {ev.class_name ? ` · ${ev.class_name}` : ''}
                            {ev.start_time ? ` · ${ev.start_time}` : ''}
                          </p>
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

      {/* MODAL CRIAR / EDITAR EVENTO */}
      <Modal
        open={open}
        title={editingId ? 'Editar evento' : 'Novo evento'}
        onClose={() => { reset(); setEditingId(null); setOpen(false); }}
        footer={
          <>
            <button className="btn-outline" onClick={() => { reset(); setEditingId(null); setOpen(false); }}>Cancelar</button>
            <button className="btn-primary" form="calendar-form" type="submit">{editingId ? 'Salvar alterações' : 'Criar evento'}</button>
          </>
        }
      >
        <form id="calendar-form" className="space-y-4" onSubmit={handleSubmit(onSave)}>
          <div>
            <label className="label">Título *</label>
            <input className="input" placeholder="Ex.: Prova de Matemática" {...register('title', { required: 'Informe o título' })} />
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
              <p className="mt-1 text-xs text-ink-muted">Deixe vazio para 1 dia.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tipo *</label>
              <select className="input" {...register('event_type', { required: true })}>
                {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Para qual turma?</label>
              <select className="input" {...register('class_id')}>
                <option value="">Toda a escola</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
            <label className="label">Descrição</label>
            <input className="input" placeholder="Detalhes opcionais" {...register('description')} />
          </div>
        </form>
      </Modal>

      {/* MODAL VER EVENTOS DO DIA */}
      <Modal
        open={dayOpen}
        title={selectedDayLabel}
        onClose={() => setDayOpen(false)}
        footer={
          <div className="flex gap-2">
            {isAdmin && (
              <button className="btn-primary" onClick={() => {
                setDayOpen(false);
                const dateStr = selectedDay[0]?.date_start ?? '';
                openCreate(dateStr);
              }}>
                <Plus size={14} /> Novo evento neste dia
              </button>
            )}
            <button className="btn-outline" onClick={() => setDayOpen(false)}>Fechar</button>
          </div>
        }
      >
        <div className="space-y-3">
          {selectedDay.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nenhum evento" description="" />
          ) : (
            selectedDay.map(ev => {
              const isNat = 'isNational' in (ev as any);
              return (
                <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                  <div className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${TYPE_DOT[ev.event_type]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{ev.title}</p>
                    <p className="text-xs text-ink-muted">
                      {EVENT_TYPE_LABELS[ev.event_type]}
                      {ev.class_name ? ` · ${ev.class_name}` : ''}
                      {ev.start_time ? ` · ${ev.start_time}${ev.end_time ? `–${ev.end_time}` : ''}` : ''}
                    </p>
                    {ev.description && <p className="mt-1 text-xs text-ink-subtle">{ev.description}</p>}
                    {isNat && <p className="mt-1 text-xs italic text-ink-muted">Feriado Nacional</p>}
                  </div>
                  {isAdmin && !isNat && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        title="Editar evento"
                        className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-soft hover:text-primary"
                        onClick={() => openEditOrCopy(ev, 'edit')}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        title="Duplicar para outro dia/horário"
                        className="rounded-lg p-1.5 text-ink-muted hover:bg-success-soft hover:text-success"
                        onClick={() => openEditOrCopy(ev, 'copy')}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        title="Excluir evento"
                        className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger"
                        onClick={() => onRemove(ev.id, ev.title)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </>
  );
}
