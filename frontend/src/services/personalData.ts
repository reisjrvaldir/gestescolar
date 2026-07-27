import { api } from '@/lib/api';

export type EntityType = 'student' | 'guardian' | 'staff';
export type SensitiveFieldName = 'cpf' | 'rg' | 'phone' | 'phone2' | 'email';

export interface AuditEntry {
  id: string;
  accessed_by: string;
  entity_type: EntityType;
  entity_name: string;
  field_name: SensitiveFieldName;
  justification: string;
  revealed_at: string;
}

export const personalDataService = {
  async reveal(params: {
    entity_type: EntityType;
    entity_id: string;
    field: SensitiveFieldName;
    justification: string;
  }): Promise<string> {
    const r = await api.post<{ ok: boolean; data: { value: string | null } }>(
      '/personal-data/reveal',
      params,
    );
    return r.data.value ?? '—';
  },

  async auditLog(): Promise<AuditEntry[]> {
    const r = await api.get<{ ok: boolean; data: AuditEntry[] }>('/personal-data/audit');
    return r.data;
  },
};
