import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp,
  BookOpen, Palette, Users, PartyPopper, Umbrella, Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { listEvents, type CalendarEvent, type EventType } from '@/services/calendar';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Marcações por tipo de evento (spec: azul=evento/passeio, laranja=prova, roxo=reunião).
const TYPE_DOT: Record<EventType, string> = {
  event: 'bg-blue-500',
  exam: 'bg-orange-500',
  meeting: 'bg-purple-500',
  holiday: 'bg-red-500',
  recess: 'bg-emerald-500',
};
const TYPE_SOFT: Record<EventType, string> = {
  event: 'bg-blue-500/10 text-blue-600',
  exam: 'bg-orange-500/10 text-orange-600',
  meeting: 'bg-purple-500/10 text-purple-600',
  holiday: 'bg-red-500/10 text-red-600',
  recess: 'bg-emerald-500/10 text-emerald-600',
};
const TYPE_LABEL: Record<EventType, string> = {
  event: 'Evento / passeio', exam: 'Prova', meeting: 'Reunião', holiday: 'Feriado', recess: 'Recesso',
};
const TYPE_ICON: Record<EventType, typeof BookOpen> = {
  event: Palette, exam: BookOpen, meeting: Users, holiday: PartyPopper, recess: Umbrella,
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Todos os dias (YYYY-MM-DD) cobertos por um evento, incluindo intervalos. */
function eventDays(ev: CalendarEvent): string[] {
  const start = new Date(ev.date_start + 'T12:00:00');
  const end = ev.date_end ? new Date(ev.date_end + 'T12:00:00') : start;
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(ymd(d));
  }
  return days;
}

export function GuardianAgenda() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    listEvents(year)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [year]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1);
    setShowAll(false);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1);
    setShowAll(false);
  }

  // Mapa dia → eventos do dia (para as marcações do calendário).
  const dayEvents = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      for (const day of eventDays(ev)) {
        (map[day] ??= []).push(ev);
      }
    }
    return map;
  }, [events]);

  // Eventos que ocorrem no mês selecionado (para o painel e o "expandir").
  const monthEvents = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return events
      .filter((ev) => eventDays(ev).some((d) => d.startsWith(prefix)))
      .sort((a, b) => (a.date_start + (a.start_time ?? '')).localeCompare(b.date_start + (b.start_time ?? '')));
  }, [events, year, month]);

  // Próximos 5 compromissos a partir de hoje.
  const upcoming = useMemo(() => {
    const todayStr = ymd(today);
    return events
      .filter((ev) => (ev.date_end ?? ev.date_start) >= todayStr)
      .sort((a, b) => (a.date_start + (a.start_time ?? '')).localeCompare(b.date_start + (b.start_time ?? '')))
      .slice(0, 5);
  }, [events]);

  // Matriz do calendário (semanas × 7 dias).
  const weeks = useMemo(() => {
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, month]);

  const todayStr = ymd(today);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /><span className="ml-2">Carregando…</span></div>;
  }

  const panelEvents = showAll ? monthEvents : upcoming;

  return (
    <>
      <PageHeader title="Agenda" subtitle="Calendário escolar e próximos compromissos do seu filho(a)." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* ============ 70% — Calendário do mês ============ */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-ink">{MONTHS[month]} {year}</h3>
            <div className="flex items-center gap-1">
              <button className="rounded-lg p-2 text-ink-muted hover:bg-canvas" onClick={prevMonth} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
              <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-canvas" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}>Hoje</button>
              <button className="rounded-lg p-2 text-ink-muted hover:bg-canvas" onClick={nextMonth} aria-label="Próximo mês"><ChevronRight size={18} /></button>
            </div>
          </div>

          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-ink-subtle">{w}</div>
            ))}
          </div>

          {/* Grade de dias */}
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((day, i) => {
              if (day === null) return <div key={i} className="h-12 sm:h-14" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const evs = dayEvents[dateStr] ?? [];
              const isToday = dateStr === todayStr;
              const types = Array.from(new Set(evs.map((e) => e.event_type)));
              return (
                <div
                  key={i}
                  className={`flex h-12 flex-col rounded-lg border p-1 sm:h-14 sm:p-1.5 ${isToday ? 'border-primary bg-primary-soft/40' : 'border-border'} ${evs.length ? '' : 'bg-canvas/30'}`}
                  title={evs.map((e) => e.title).join(', ')}
                >
                  <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-ink'}`}>{day}</span>
                  <div className="mt-auto flex flex-wrap gap-0.5">
                    {types.slice(0, 4).map((t) => (
                      <span key={t} className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[t]}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Evento / passeio</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Prova</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Reunião</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Feriado</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2.5 rounded-full border border-border" /> Aula normal</span>
          </div>
        </div>

        {/* ============ 30% — Próximos compromissos ============ */}
        <div className="card flex flex-col overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-bold text-ink">
              {showAll ? `Tudo em ${MONTHS[month]}` : 'Próximos compromissos'}
            </h3>
          </div>

          {panelEvents.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center text-ink-subtle">
              <CalendarDays size={28} className="mb-2" />
              <p className="text-sm">{showAll ? 'Nenhuma marcação neste mês.' : 'Nenhum compromisso próximo.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {panelEvents.map((ev) => {
                const Icon = TYPE_ICON[ev.event_type];
                const d = new Date(ev.date_start + 'T12:00:00');
                return (
                  <div key={ev.id + ev.date_start} className="flex items-start gap-3 px-4 py-3">
                    {/* Ícone + data (mês embaixo) */}
                    <div className="flex flex-col items-center">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${TYPE_SOFT[ev.event_type]}`}>
                        <Icon size={18} />
                      </div>
                      <span className="mt-1 text-sm font-extrabold leading-none text-ink">{String(d.getDate()).padStart(2, '0')}</span>
                      <span className="text-[10px] font-semibold uppercase text-ink-subtle">{MONTHS[d.getMonth()].slice(0, 3)}</span>
                    </div>
                    {/* Título, descrição e horário */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{ev.title}</p>
                      <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_SOFT[ev.event_type]}`}>
                        {TYPE_LABEL[ev.event_type]}
                      </span>
                      {ev.description && <p className="mt-1 text-xs text-ink-muted">{ev.description}</p>}
                      {ev.start_time && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
                          <Clock size={12} /> {ev.start_time}{ev.end_time ? ` – ${ev.end_time}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Botão expandir todas as marcações do mês */}
          <button
            className="mt-auto flex items-center justify-center gap-1.5 border-t border-border px-5 py-3 text-xs font-semibold text-primary hover:bg-canvas"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? <><ChevronUp size={14} /> Ver só os próximos</> : <><ChevronDown size={14} /> Ver todas as marcações do mês</>}
          </button>
        </div>
      </div>
    </>
  );
}
