import { api } from '@/lib/api';

export interface GradeRow {
  id: string;
  student_id: string;
  student_name: string;
  grade: number;
}

export interface BoletimStudent {
  id: string;
  name: string;
  registration_number?: string;
}

export interface BoletimGrade {
  student_id: string;
  subject: string;
  period: string;
  grade: number;
}

export interface BoletimData {
  students: BoletimStudent[];
  grades: BoletimGrade[];
}

export const gradesService = {
  async forContext(classId: string, subject: string, period: string): Promise<{ rows: GradeRow[]; locked: boolean }> {
    const r = await api.get<{ ok: boolean; data: GradeRow[]; locked: boolean }>(
      `/grades?class_id=${classId}&subject=${encodeURIComponent(subject)}&period=${encodeURIComponent(period)}`,
    );
    return { rows: r.data, locked: r.locked ?? false };
  },
  async boletim(classId: string): Promise<BoletimData> {
    const r = await api.get<{ ok: boolean; data: BoletimData }>(`/grades/boletim?class_id=${classId}`);
    return r.data;
  },
  async saveBatch(classId: string, subject: string, period: string, grades: { student_id: string; grade: number }[]): Promise<void> {
    await api.post('/grades/batch', { class_id: classId, subject, period, grades });
  },
};
