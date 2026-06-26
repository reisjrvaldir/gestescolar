export type StudentStatus = 'active' | 'inactive';

export interface Student {
  id: string;
  name: string;
  registration_number: string;
  cpf?: string;
  birth_date?: string;
  father_name?: string;
  mother_name?: string;
  monthly_fee?: number;
  plan_id?: string;
  class_id?: string;
  class_name?: string;
  guardian_id?: string;
  guardian_name?: string;
  guardian_email?: string;
  status: StudentStatus;
  created_at: string;
}

export type Shift = 'morning' | 'afternoon' | 'night' | 'full';

export interface SchoolClass {
  id: string;
  name: string;
  year: number;
  level?: string;
  shift: Shift;
  teacher_name?: string;
  student_count: number;
  status: 'active' | 'inactive';
  created_at: string;
}

export const SHIFT_LABELS: Record<Shift, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
  full: 'Integral',
};

export type StaffRole = 'school_admin' | 'financial' | 'teacher' | 'coordinator';

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  registration_number?: string;
  role: StaffRole;
  role_type?: StaffRole;
  subject_teaches?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  school_admin: 'Gestor/Admin',
  financial: 'Financeiro',
  teacher: 'Professor',
  coordinator: 'Coordenação',
};
