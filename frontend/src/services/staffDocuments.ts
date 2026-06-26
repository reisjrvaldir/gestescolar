import { api } from '@/lib/api';

export type DocType = 'certificado' | 'atestado' | 'certidao' | 'outro';

export interface StaffDocument {
  id: string;
  type: DocType;
  filename: string;
  mime_type?: string;
  file_size?: number;
  description?: string;
  created_at: string;
}

export interface StaffDocumentFull extends StaffDocument {
  file_data: string;
  user_id: string;
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  certificado: 'Certificado',
  atestado: 'Atestado médico',
  certidao: 'Certidão',
  outro: 'Outro',
};

export const staffDocumentsService = {
  async list(userId?: string): Promise<StaffDocument[]> {
    const q = userId ? `?user_id=${userId}` : '';
    const r = await api.get<{ data: StaffDocument[] }>(`/staff-documents${q}`);
    return r.data;
  },
  async get(id: string): Promise<StaffDocumentFull> {
    const r = await api.get<{ data: StaffDocumentFull }>(`/staff-documents/${id}`);
    return r.data;
  },
  async upload(input: {
    type: DocType;
    filename: string;
    mime_type?: string;
    file_size?: number;
    file_data: string;
    description?: string;
  }): Promise<StaffDocument> {
    const r = await api.post<{ data: StaffDocument }>('/staff-documents', input);
    return r.data;
  },
  async remove(id: string): Promise<void> {
    await api.del(`/staff-documents/${id}`);
  },
};
