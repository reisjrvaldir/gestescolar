import type { SchoolClass, Shift } from '@/types/models';
import { api } from '@/lib/api';

export interface NewClass {
  name: string;
  year: number;
  level?: string;
  shift: Shift;
  teacher_id?: string;
}

export const classesService = {
  async list(): Promise<SchoolClass[]> {
    const r = await api.get<{ ok: boolean; data: SchoolClass[] }>('/classes');
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
};
