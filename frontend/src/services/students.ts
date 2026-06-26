import type { Student } from '@/types/models';
import { api } from '@/lib/api';

export interface NewStudent {
  name: string;
  cpf: string;
  birth_date: string;
  father_name: string;
  mother_name: string;
  class_id?: string;
  plan_id: string;
  guardian: {
    name: string;
    email: string;
    cpf: string;
    phone?: string;
  };
}

export interface UpdateStudent {
  name?: string;
  cpf?: string;
  birth_date?: string;
  father_name?: string;
  mother_name?: string;
  class_id?: string;
  plan_id?: string;
}

export interface CreatedStudent extends Student {
  monthly_fee?: number;
  guardian_email?: string;
  initial_password?: string;
  login_password_hint?: string;
}

export const studentsService = {
  async list(): Promise<Student[]> {
    const r = await api.get<{ ok: boolean; data: Student[] }>('/students');
    return r.data;
  },
  async create(input: NewStudent): Promise<CreatedStudent> {
    const r = await api.post<{ ok: boolean; data: CreatedStudent }>('/students', input);
    return r.data;
  },
  async update(id: string, input: UpdateStudent): Promise<Student> {
    const r = await api.put<{ ok: boolean; data: Student }>(`/students/${id}`, input);
    return r.data;
  },
  async remove(id: string): Promise<void> {
    await api.del(`/students/${id}`);
  },
};
