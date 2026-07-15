import { api } from '@/lib/api';

export type AttendanceStatus = 'present' | 'absent' | 'justified';

export interface AttendanceRow {
  id: string;
  student_id: string;
  student_name: string;
  status: AttendanceStatus;
  justification?: string;
}

export interface CalendarDay {
  date: string;
  subject_id: string | null;
  total: number;
  present: number;
  absent: number;
  justified: number;
}

export const attendanceService = {
  async forContext(classId: string, date: string, subjectId?: string): Promise<{ rows: AttendanceRow[]; locked: boolean }> {
    const q = `class_id=${classId}&date=${date}${subjectId ? `&subject_id=${subjectId}` : ''}`;
    const r = await api.get<{ ok: boolean; data: AttendanceRow[]; locked: boolean }>(`/attendance?${q}`);
    return { rows: r.data, locked: r.locked ?? false };
  },
  async saveBatch(
    classId: string,
    date: string,
    entries: { student_id: string; status: AttendanceStatus; justification?: string }[],
    subjectId?: string,
  ): Promise<void> {
    await api.post('/attendance/batch', {
      class_id: classId, date, entries,
      ...(subjectId ? { subject_id: subjectId } : {}),
    });
  },
  async calendar(classId: string, year: number, month: number): Promise<CalendarDay[]> {
    const r = await api.get<{ ok: boolean; data: CalendarDay[] }>(
      `/attendance/calendar?class_id=${classId}&year=${year}&month=${month}`,
    );
    return r.data;
  },
};
