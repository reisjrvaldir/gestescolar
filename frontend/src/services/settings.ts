import { api } from '@/lib/api';

export interface SchoolSettings {
  id: string;
  name: string;
  legal_name?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
  status: string;
  subscription_status: string;
  trial_ends_at?: string;
}

export interface UpdateSchoolSettings {
  name?: string;
  legal_name?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
}

export const settingsService = {
  async get(): Promise<SchoolSettings> {
    const r = await api.get<{ ok: boolean; data: SchoolSettings }>('/settings');
    return r.data;
  },
  async update(data: UpdateSchoolSettings): Promise<void> {
    await api.put('/settings', data);
  },
};
