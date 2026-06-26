import { api } from '@/lib/api';

export interface GradeRow {
  id: string;
  student_id: string;
  student_name: string;
  grade: number;
}

export const gradesService = {
  async forContext(classId: string, subject: string, period: string): Promise<GradeRow[]> {
    const r = await api.get<{ ok: boolean; data: GradeRow[] }>(
      `/grades?class_id=${classId}&subject=${encodeURIComponent(subject)}&period=${encodeURIComponent(period)}`,
    );
    return r.data;
  },
  async saveBatch(classId: string, subject: string, period: string, grades: { student_id: string; grade: number }[]): Promise<void> {
    await api.post('/grades/batch', { class_id: classId, subject, period, grades });
  },
};
