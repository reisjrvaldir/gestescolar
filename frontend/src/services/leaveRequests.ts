import { api } from '@/lib/api';

export type LeaveType = 'folga' | 'licenca' | 'ferias';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason?: string;
  status: LeaveStatus;
  user_name?: string;
  created_at: string;
  decided_at?: string;
  decision_note?: string;
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  folga: 'Folga',
  licenca: 'Licença',
  ferias: 'Férias',
};

export const leaveRequestsService = {
  async list(): Promise<LeaveRequest[]> {
    const r = await api.get<{ data: LeaveRequest[] }>('/leave-requests');
    return r.data;
  },
  async create(data: { type: LeaveType; start_date: string; end_date: string; reason?: string }): Promise<LeaveRequest> {
    const r = await api.post<{ data: LeaveRequest }>('/leave-requests', data);
    return r.data;
  },
  async decide(id: string, status: 'approved' | 'rejected', decision_note?: string): Promise<LeaveRequest> {
    const r = await api.patch<{ data: LeaveRequest }>(`/leave-requests/${id}/decide`, { status, decision_note });
    return r.data;
  },
};
