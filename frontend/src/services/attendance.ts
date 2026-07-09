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
  async forContext(classId: string, date: string, subjectId?: string): Promise<AttendanceRow[]> {
    const q = `class_id=${classId}&date=${date}${subjectId ? `&subject_id=${subjectId}` : ''}`;
    const r = await api.get<{ ok: boolean; data: AttendanceRow[] }>(`/attendance?${q}`);
    return r.data;
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
};
