export type StudentStatus = 'active' | 'inactive';

export interface Student {
  id: string;
  name: string;
  registration_number: string;
  cpf?: string;
  rg?: string;
  birth_date?: string;
  blood_type?: string;
  naturality?: string;
  photo_url?: string;
  father_name?: string;
  mother_name?: string;
  monthly_fee?: number;
  plan_id?: string;
  class_id?: string;
  class_name?: string;
  guardian_id?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_cpf?: string;
  guardian_phone?: string;
  guardian_phone2?: string;
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
  subject_ids?: string[];
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
  position?: string;
  admission_date?: string;
  contract_type?: 'clt' | 'pj' | 'estagio' | 'temporario';
  weekly_hours?: number;
  status: 'active' | 'inactive';
  created_at: string;
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  school_admin: 'Gestor/Admin',
  financial: 'Financeiro',
  teacher: 'Professor',
  coordinator: 'Coordenação',
};
