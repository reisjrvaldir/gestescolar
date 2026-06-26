import { api } from '@/lib/api';

export interface Schedule {
  id: string;
  user_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  user_name?: string;
}

export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export async function listSchedules(userId?: string): Promise<Schedule[]> {
  const q = userId ? `?user_id=${userId}` : '';
  const r = await api.get<{ data: Schedule[] }>(`/schedules${q}`);
  return r.data;
}

export async function createSchedule(data: Omit<Schedule, 'id' | 'user_name'>): Promise<Schedule> {
  const r = await api.post<{ data: Schedule }>('/schedules', data);
  return r.data;
}

export async function removeSchedule(id: string): Promise<void> {
  await api.del(`/schedules/${id}`);
}
