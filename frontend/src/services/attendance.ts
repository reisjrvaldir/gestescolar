import { api } from '@/lib/api';

export type AttendanceStatus = 'present' | 'absent' | 'justified';

export interface AttendanceRow {
  id: string;
  student_id: string;
  student_name: string;
  status: AttendanceStatus;
  justification?: string;
}

export const attendanceService = {
  async forContext(classId: string, date: string): Promise<AttendanceRow[]> {
    const r = await api.get<{ ok: boolean; data: AttendanceRow[] }>(
      `/attendance?class_id=${classId}&date=${date}`,
    );
    return r.data;
  },
  async saveBatch(classId: string, date: string, entries: { student_id: string; status: AttendanceStatus; justification?: string }[]): Promise<void> {
    await api.post('/attendance/batch', { class_id: classId, date, entries });
  },
};
