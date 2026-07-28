import { randomBytes, createHash } from 'crypto';
import type { PoolClient } from '@neondatabase/serverless';

/** Validade curta do convite (horas). */
export const INVITE_TTL_HOURS = 72;

/** Bytes de entropia do token cru (32 bytes = 256 bits). */
const TOKEN_BYTES = 32;

export interface GeneratedToken {
  /** Token cru — vai APENAS no link enviado ao usuário; nunca é persistido. */
  token: string;
  /** SHA-256 hex do token — o único valor gravado no banco. */
  tokenHash: string;
}

/** Gera um token aleatório de uso único e o hash que será armazenado. */
export function generateInviteToken(): GeneratedToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

/** SHA-256 hex — determinístico, usado para localizar o convite sem guardar o token cru. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Instante de expiração a partir de agora. */
export function inviteExpiry(hours = INVITE_TTL_HOURS): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

export type InviteState = 'pending' | 'expired' | 'activated' | 'none';

export interface CreateInviteParams {
  schoolId: string;
  profileId: string;
  authUserId: string;
  email: string;
  purpose: 'invite' | 'recovery';
  createdByProfileId?: string | null;
  createdByEmail?: string | null;
}

/**
 * Cria um convite: revoga qualquer convite pendente anterior do mesmo profile
 * (garante uso único do link mais recente) e grava o novo com hash + expiração.
 * Registra auditoria ('sent' na primeira vez, 'resent' se já havia pendente).
 * Retorna o token CRU (para montar o link) — quem chama não deve loggá-lo.
 */
export async function createInvitation(
  c: PoolClient,
  p: CreateInviteParams,
): Promise<{ token: string; invitationId: string; wasResend: boolean }> {
  const prev = await c.query(
    `update public.user_invitations
        set status='revoked', revoked_at=now()
      where profile_id=$1 and school_id=$2 and status='pending'
      returning id`,
    [p.profileId, p.schoolId],
  );
  const wasResend = prev.rows.length > 0;

  const { token, tokenHash } = generateInviteToken();
  const ins = await c.query(
    `insert into public.user_invitations
       (school_id, profile_id, auth_user_id, email, token_hash, purpose, status,
        created_by, created_by_email, expires_at)
     values ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9)
     returning id`,
    [p.schoolId, p.profileId, p.authUserId, p.email, tokenHash, p.purpose,
     p.createdByProfileId ?? null, p.createdByEmail ?? null, inviteExpiry()],
  );
  const invitationId = ins.rows[0].id;

  await c.query(
    `insert into public.invitation_audit_log
       (school_id, invitation_id, action, actor_profile_id, actor_email, target_email)
     values ($1,$2,$3,$4,$5,$6)`,
    [p.schoolId, invitationId, wasResend ? 'resent' : 'sent',
     p.createdByProfileId ?? null, p.createdByEmail ?? null, p.email],
  );

  return { token, invitationId, wasResend };
}

/**
 * Deriva o estado do acesso de um profile a partir do timestamp de ativação e
 * do convite mais recente. Usado nas listagens (badge de status).
 */
export function deriveInviteState(row: {
  access_activated_at?: string | null;
  latest_invite_status?: string | null;
  latest_invite_expires_at?: string | null;
}): InviteState {
  if (row.access_activated_at) return 'activated';
  const status = row.latest_invite_status;
  if (!status) return 'none';
  if (status === 'accepted') return 'activated';
  if (status === 'pending') {
    const exp = row.latest_invite_expires_at ? new Date(row.latest_invite_expires_at).getTime() : 0;
    return exp > Date.now() ? 'pending' : 'expired';
  }
  // revoked/expired
  return 'expired';
}

/** SQL reutilizável: estado do convite mais recente por profile (subquery correlata). */
export const LATEST_INVITE_SQL = `
  (select i.status from public.user_invitations i
    where i.profile_id = p.id order by i.created_at desc limit 1)      as latest_invite_status,
  (select i.expires_at from public.user_invitations i
    where i.profile_id = p.id order by i.created_at desc limit 1)      as latest_invite_expires_at,
  p.access_activated_at
`;
