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
  address_zip?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
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

export interface StudentFull extends Omit<Student, 'guardian_id'> {
  guardian_id?: string | null;
  address_zip?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
}

export const studentsService = {
  async list(): Promise<Student[]> {
    const r = await api.get<{ ok: boolean; data: Student[] }>('/students');
    return r.data;
  },
  /** Dados completos (sem máscara) para o formulário de edição. */
  async getFull(id: string): Promise<StudentFull> {
    const r = await api.get<{ ok: boolean; data: StudentFull }>(`/students/${id}/full`);
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
