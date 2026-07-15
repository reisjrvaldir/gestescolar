import { api } from '@/lib/api';

export type AttendanceStatus = 'present' | 'absent' | 'justified' | 'attested' | 'excused';
export type AttestationStatus = 'pending' | 'approved' | 'rejected';

export interface AttendanceRow {
  id: string;
  student_id: string;
  student_name: string;
  registration_number?: string;
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
  attested: number;
  excused: number;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  justified: number;
  attested: number;
  excused: number;
}

export interface TopAbsence {
  student_id: string;
  student_name: string;
  class_name: string | null;
  absences: number;
}

export interface PendingApproval {
  id: string;
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string | null;
  date: string;
  filename: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by_guardian: boolean;
}

export interface MyChild {
  student_id: string;
  student_name: string;
  class_id: string | null;
  class_name: string | null;
}

export interface MyAttestation {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  filename: string;
  status: AttestationStatus;
  uploaded_at: string;
  review_note?: string;
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
  async uploadAttestation(params: {
    student_id: string;
    class_id: string;
    date: string;
    filename: string;
    file_size: number;
    file_data: string; // base64
  }): Promise<void> {
    await api.post('/attendance/attestation', params);
  },
  async getAttestation(studentId: string, classId: string, date: string): Promise<{
    filename: string; file_size: number; file_data: string; status: AttestationStatus; review_note?: string;
  }> {
    const r = await api.get<{ ok: boolean; data: { filename: string; file_size: number; file_data: string; status: AttestationStatus; review_note?: string } }>(
      `/attendance/attestation?student_id=${studentId}&class_id=${classId}&date=${date}`,
    );
    return r.data;
  },
  async calendar(classId: string, year: number, month: number): Promise<CalendarDay[]> {
    const r = await api.get<{ ok: boolean; data: CalendarDay[] }>(
      `/attendance/calendar?class_id=${classId}&year=${year}&month=${month}`,
    );
    return r.data;
  },
  async summary(classId: string | undefined, scope: 'month' | '30d'): Promise<AttendanceSummary> {
    const q = `scope=${scope}${classId ? `&class_id=${classId}` : ''}`;
    const r = await api.get<{ ok: boolean; data: AttendanceSummary }>(`/attendance/summary?${q}`);
    return r.data;
  },
  async topAbsences(classId: string | undefined, year: number, month: number, limit = 5): Promise<TopAbsence[]> {
    const q = `year=${year}&month=${month}&limit=${limit}${classId ? `&class_id=${classId}` : ''}`;
    const r = await api.get<{ ok: boolean; data: TopAbsence[] }>(`/attendance/top-absences?${q}`);
    return r.data;
  },
  async pendingApprovals(): Promise<PendingApproval[]> {
    const r = await api.get<{ ok: boolean; data: PendingApproval[] }>('/attendance/pending-approvals');
    return r.data;
  },
  async reviewAttestation(id: string, action: 'approve' | 'reject', note?: string): Promise<void> {
    await api.post(`/attendance/attestation/${id}/review`, { action, note });
  },
  async myChildren(): Promise<MyChild[]> {
    const r = await api.get<{ ok: boolean; data: MyChild[] }>('/attendance/my-children');
    return r.data;
  },
  async myAttestations(): Promise<MyAttestation[]> {
    const r = await api.get<{ ok: boolean; data: MyAttestation[] }>('/attendance/attestation/mine');
    return r.data;
  },
  async uploadMyAttestation(params: {
    student_id: string;
    date: string;
    filename: string;
    file_size: number;
    file_data: string;
  }): Promise<void> {
    await api.post('/attendance/attestation/mine', params);
  },
};
