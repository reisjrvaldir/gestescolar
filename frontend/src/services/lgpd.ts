import { api } from '@/lib/api';

export interface LgpdRequest {
  id: string;
  type: 'export' | 'deletion';
  status: string;
  created_at: string;
}

export interface ConsentEntry {
  id: string;
  terms_version: string;
  privacy_version: string;
  accepted_at: string;
  purpose: 'signup' | 'reconsent';
}

export async function listRequests(): Promise<LgpdRequest[]> {
  const r = await api.get<{ data: LgpdRequest[] }>('/lgpd/requests');
  return r.data;
}

export async function listConsents(): Promise<ConsentEntry[]> {
  const r = await api.get<{ data: ConsentEntry[] }>('/me/consents');
  return r.data;
}

export async function requestExport(): Promise<{ download: unknown }> {
  return api.post('/lgpd/export');
}

export async function requestDeletion(): Promise<void> {
  await api.post('/lgpd/deletion');
}
