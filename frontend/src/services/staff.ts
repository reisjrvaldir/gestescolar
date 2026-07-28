import type { Staff } from '@/types/models';
import { api } from '@/lib/api';

export type ContractType = 'clt' | 'pj' | 'estagio' | 'temporario';

export interface NewStaff {
  name: string;
  cpf: string;
  email: string;
  phone?: string;
  role_type: 'school_admin' | 'financial' | 'teacher' | 'coordinator';
  subject_teaches?: string;
  position?: string;
  admission_date?: string;
  contract_type?: ContractType;
  weekly_hours?: number;
  timeclock_enabled?: boolean;
}

export interface UpdateStaff {
  name?: string;
  cpf?: string;
  email?: string;
  phone?: string;
  role_type?: NewStaff['role_type'];
  subject_teaches?: string;
  position?: string;
  admission_date?: string;
  contract_type?: ContractType;
  weekly_hours?: number;
  timeclock_enabled?: boolean;
}

export interface CreatedStaff extends Staff {
  registration_number?: string;
  login_matricula?: string;
  invite_state?: 'pending';
  invite_emailed?: boolean;
  login_hint?: string;
}

export const staffService = {
  async list(): Promise<Staff[]> {
    const r = await api.get<{ ok: boolean; data: Staff[] }>('/staff');
    return r.data;
  },
  async create(input: NewStaff): Promise<CreatedStaff> {
    const r = await api.post<{ ok: boolean; data: CreatedStaff }>('/staff', input);
    return r.data;
  },
  async update(id: string, input: UpdateStaff): Promise<Staff> {
    const r = await api.put<{ ok: boolean; data: Staff }>(`/staff/${id}`, input);
    return r.data;
  },
  async remove(id: string): Promise<void> {
    await api.del(`/staff/${id}`);
  },
  /** Envia/reenvia o convite de acesso (o funcionário define a própria senha). */
  async sendInvite(id: string): Promise<{ emailed: boolean; wasResend: boolean; purpose: 'invite' | 'recovery' }> {
    const r = await api.post<{ ok: boolean; data: { emailed: boolean; wasResend: boolean; purpose: 'invite' | 'recovery' } }>(
      `/staff/${id}/invite`, {},
    );
    return r.data;
  },
};
