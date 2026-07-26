import { api } from '@/lib/api';

export type EventType = 'holiday' | 'exam' | 'meeting' | 'event' | 'recess';

export interface CalendarEvent {
  id: string;
  title: string;
  date_start: string;
  date_end?: string;
  event_type: EventType;
  description?: string;
  start_time?: string | null;
  end_time?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  created_at: string;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  holiday: 'Feriado',
  exam: 'Prova',
  meeting: 'Reunião',
  event: 'Evento',
  recess: 'Recesso',
};

export async function listEvents(year?: number): Promise<CalendarEvent[]> {
  const q = year ? `?year=${year}` : '';
  const r = await api.get<{ data: CalendarEvent[] }>(`/calendar${q}`);
  // Colunas `date` do Postgres podem chegar como ISO completo ("2026-07-26T03:00:00.000Z");
  // todo o app compara/concatena datas como "YYYY-MM-DD", então normaliza aqui.
  return r.data.map(e => ({
    ...e,
    date_start: e.date_start?.slice(0, 10),
    date_end: e.date_end ? e.date_end.slice(0, 10) : e.date_end,
  }));
}

export async function createEvent(data: Omit<CalendarEvent, 'id' | 'created_at'>): Promise<CalendarEvent> {
  const r = await api.post<{ data: CalendarEvent }>('/calendar', data);
  return r.data;
}

export async function removeEvent(id: string): Promise<void> {
  await api.del(`/calendar/${id}`);
}
