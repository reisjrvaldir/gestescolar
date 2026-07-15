import { api } from '@/lib/api';

export interface SchoolPlan {
  id: string;
  name: string;
  monthly_fee: number;
  enrollment_fee: number;
  status: string;
  created_at: string;
}

export interface NewSchoolPlan {
  name: string;
  monthly_fee: number;
  enrollment_fee: number;
}

export const schoolPlansService = {
  async list(): Promise<SchoolPlan[]> {
    const r = await api.get<{ data: SchoolPlan[] }>('/school-plans');
    return r.data;
  },
  async create(input: NewSchoolPlan): Promise<SchoolPlan> {
    const r = await api.post<{ data: SchoolPlan }>('/school-plans', input);
    return r.data;
  },
  async update(id: string, input: NewSchoolPlan): Promise<SchoolPlan> {
    const r = await api.put<{ data: SchoolPlan }>(`/school-plans/${id}`, input);
    return r.data;
  },
  async remove(id: string): Promise<void> {
    await api.del(`/school-plans/${id}`);
  },
};
