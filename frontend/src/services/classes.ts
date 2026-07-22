import type { SchoolClass, Shift } from '@/types/models';
import { api } from '@/lib/api';

export interface ClassSubjectAssignment {
  subject_id: string;
  teacher_id?: string | null;
}

export interface NewClass {
  name: string;
  year: number;
  level?: string;
  shift: Shift;
  teacher_id?: string;
  subject_ids?: string[];
  subjects?: ClassSubjectAssignment[];
}

export interface ClassStudent {
  id: string;
  name: string;
  registration_number?: string;
  status: string;
}

export interface ClassSubject {
  id: string;
  name: string;
}

export const classesService = {
  async list(): Promise<SchoolClass[]> {
    const r = await api.get<{ ok: boolean; data: SchoolClass[] }>('/classes');
    return r.data;
  },
  /** Turmas do professor logado (onde ele é o regente). */
  async mine(): Promise<SchoolClass[]> {
    const r = await api.get<{ ok: boolean; data: SchoolClass[] }>('/classes/mine');
    return r.data;
  },
  async create(input: NewClass): Promise<SchoolClass> {
    const r = await api.post<{ ok: boolean; data: SchoolClass }>('/classes', input);
    return r.data;
  },
  async update(id: string, input: NewClass): Promise<SchoolClass> {
    const r = await api.put<{ ok: boolean; data: SchoolClass }>(`/classes/${id}`, input);
    return r.data;
  },
  async remove(id: string): Promise<void> {
    await api.del(`/classes/${id}`);
  },
  async students(id: string): Promise<ClassStudent[]> {
    const r = await api.get<{ ok: boolean; data: ClassStudent[] }>(`/classes/${id}/students`);
    return r.data;
  },
  async subjects(id: string): Promise<ClassSubject[]> {
    const r = await api.get<{ ok: boolean; data: ClassSubject[] }>(`/classes/${id}/subjects`);
    return r.data;
  },
};
