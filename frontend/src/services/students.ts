import type { Student } from '@/types/models';
import { api } from '@/lib/api';

export interface NewStudent {
  name: string;
  cpf: string;
  rg?: string;
  birth_date: string;
  blood_type?: string;
  naturality?: string;
  photo_url?: string;
  father_name: string;
  mother_name: string;
  class_id?: string;
  plan_id: string;
  discount_percentage?: number;
  enrollment_payment_method?: 'cash' | 'pix' | 'card';
  first_due?: '30' | '05' | '10' | '15';
  guardian: {
    name: string;
    email: string;
    cpf: string;
    phone?: string;
    phone2?: string;
  };
}

export interface UpdateStudent {
  name?: string;
  cpf?: string;
  rg?: string;
  birth_date?: string;
  blood_type?: string;
  naturality?: string;
  photo_url?: string;
  father_name?: string;
  mother_name?: string;
  class_id?: string;
  plan_id?: string;
}

export interface CreatedStudent extends Student {
  monthly_fee?: number;
  enrollment_fee?: number;
  enrollment_paid?: boolean;
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
