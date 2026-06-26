import { api } from '@/lib/api';

export interface LgpdRequest {
  id: string;
  type: 'export' | 'deletion';
  status: string;
  created_at: string;
}

export async function listRequests(): Promise<LgpdRequest[]> {
  const r = await api.get<{ data: LgpdRequest[] }>('/lgpd/requests');
  return r.data;
}

export async function requestExport(): Promise<{ download: unknown }> {
  return api.post('/lgpd/export');
}

export async function requestDeletion(): Promise<void> {
  await api.post('/lgpd/deletion');
}
