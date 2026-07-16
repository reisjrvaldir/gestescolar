import { api } from '@/lib/api';

export interface GradeEntryRow {
  student_id: string;
  student_name: string;
  registration_number?: string;
  av1: number | null;
  av2: number | null;
  final_grade: number | null;
}

export interface GradeSettings {
  passing_grade: number;
  final_passing_grade: number;
}

export interface GradeSummary {
  statusCounts: {
    approved: number;
    approved_final: number;
    recovery: number;
    failed: number;
  };
  bySubject: {
    subject: string;
    avg: number;
    passing_rate: number;
    total: number;
  }[];
  passingGrade: number;
  finalPassingGrade: number;
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
  assessment_type: 'av1' | 'av2' | 'final';
  grade: number;
}

export interface BoletimData {
  students: BoletimStudent[];
  grades: BoletimGrade[];
}

export interface MyBoletimStudent {
  id: string;
  name: string;
  registration_number?: string;
  class_id?: string;
  class_name?: string;
}

export interface MyBoletimRanking {
  student_id: string;
  avg_grade: number;
  class_id: string;
}

export interface MyBoletimData {
  students: MyBoletimStudent[];
  grades: BoletimGrade[];
  settings: GradeSettings;
  ranking: MyBoletimRanking[];
}

export const gradesService = {
  async getSettings(): Promise<GradeSettings> {
    const r = await api.get<{ ok: boolean; data: GradeSettings }>('/grades/settings');
    return r.data;
  },
  async saveSettings(settings: GradeSettings): Promise<void> {
    await api.put('/grades/settings', settings);
  },
  async forContext(classId: string, subject: string, period: string): Promise<{ rows: GradeEntryRow[]; locked: boolean }> {
    const r = await api.get<{ ok: boolean; data: GradeEntryRow[]; locked: boolean }>(
      `/grades?class_id=${classId}&subject=${encodeURIComponent(subject)}&period=${encodeURIComponent(period)}`,
    );
    return { rows: r.data, locked: r.locked ?? false };
  },
  async summary(classId: string, period: string): Promise<GradeSummary> {
    const r = await api.get<{ ok: boolean; data: GradeSummary }>(
      `/grades/summary?class_id=${classId}&period=${encodeURIComponent(period)}`,
    );
    return r.data;
  },
  async boletim(classId: string): Promise<BoletimData> {
    const r = await api.get<{ ok: boolean; data: BoletimData }>(`/grades/boletim?class_id=${classId}`);
    return r.data;
  },
  async myBoletim(): Promise<MyBoletimData> {
    const r = await api.get<{ ok: boolean; data: MyBoletimData }>('/grades/my-boletim');
    return r.data;
  },
  async saveBatch(
    classId: string,
    subject: string,
    period: string,
    entries: { student_id: string; av1?: number; av2?: number; final?: number }[],
  ): Promise<void> {
    await api.post('/grades/batch', { class_id: classId, subject, period, entries });
  },
};
