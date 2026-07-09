import { api } from '@/lib/api';

export interface Subject {
  id: string;
  name: string;
  level: string; // infantil | fundamental | medio | outros
}

export const LEVEL_LABELS: Record<string, string> = {
  infantil: 'Infantil',
  fundamental: 'Fundamental',
  medio: 'Médio',
  outros: 'Outras',
};
export const LEVEL_ORDER = ['infantil', 'fundamental', 'medio', 'outros'];

export const subjectsService = {
  async list(): Promise<Subject[]> {
    const r = await api.get<{ ok: boolean; data: Subject[] }>('/subjects');
    return r.data;
  },
};
