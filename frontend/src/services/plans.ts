import { api } from '@/lib/api';

export interface SaasPlan {
  id: string;
  name: string;
  student_limit: number | null;
  monthly_price: number;
  annual_price: number;
  discount_percentage: number;
  features_json: string[];
}

export const plansService = {
  async list(): Promise<SaasPlan[]> {
    const res = await api.get<{ ok: boolean; data: SaasPlan[] }>('/plans');
    return res.data;
  },
};
