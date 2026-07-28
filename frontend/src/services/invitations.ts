import { api } from '@/lib/api';

export interface InviteResult {
  emailed: boolean;
  wasResend: boolean;
  purpose: 'invite' | 'recovery';
}

export interface InviteInfo {
  valid: boolean;
  state?: 'expired' | 'accepted' | 'revoked';
  purpose?: 'invite' | 'recovery';
  name?: string;
  email_masked?: string;
}

export const invitationsService = {
  /** Envia/reenvia convite de acesso ao responsável de um aluno. */
  sendStudentInvite(studentId: string): Promise<InviteResult> {
    return api.post<{ ok: boolean; data: InviteResult }>(`/students/${studentId}/invite`, {}).then((r) => r.data);
  },
  /** Envia/reenvia convite de acesso a um funcionário. */
  sendStaffInvite(staffId: string): Promise<InviteResult> {
    return api.post<{ ok: boolean; data: InviteResult }>(`/staff/${staffId}/invite`, {}).then((r) => r.data);
  },

  // ── Fluxo público de aceite (sem autenticação) ──
  /** Valida um token de convite e retorna o estado para a tela de aceite. */
  getInvite(token: string): Promise<InviteInfo> {
    return api.get<{ ok: boolean; data: InviteInfo }>(`/public/invite/${encodeURIComponent(token)}`).then((r) => r.data);
  },
  /** Consome o convite definindo a senha escolhida pelo usuário. */
  acceptInvite(token: string, password: string): Promise<{ email: string }> {
    return api.post<{ ok: boolean; data: { email: string } }>(`/public/invite/accept`, { token, password }).then((r) => r.data);
  },
};
