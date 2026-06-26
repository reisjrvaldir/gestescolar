import { api } from '@/lib/api';

export interface TimeclockEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  notes?: string;
  user_name?: string;
  created_at?: string;
}

export async function listMyEntries(month?: string): Promise<TimeclockEntry[]> {
  const q = month ? `?month=${month}` : '';
  const r = await api.get<{ data: TimeclockEntry[] }>(`/timeclock${q}`);
  return r.data;
}

export async function listAllEntries(): Promise<TimeclockEntry[]> {
  const r = await api.get<{ data: TimeclockEntry[] }>('/timeclock/all');
  return r.data;
}

export async function clockIn(): Promise<TimeclockEntry> {
  const r = await api.post<{ data: TimeclockEntry }>('/timeclock/clock-in');
  return r.data;
}

export async function clockOut(): Promise<TimeclockEntry> {
  const r = await api.post<{ data: TimeclockEntry }>('/timeclock/clock-out');
  return r.data;
}
