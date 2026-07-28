import type { PoolClient } from '@neondatabase/serverless';
import { createInvitation, type CreateInviteParams } from './invitations';
import { sendInviteEmail } from './email';
import { INVITE_TTL_HOURS } from './invitations';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://gestescolar.com.br';

/**
 * Emite um convite e dispara o e-mail com o link de uso único.
 * O token cru circula apenas na URL do e-mail — não é retornado nem logado.
 * Retorna se foi reenvio e se o e-mail saiu (para a UI dar feedback).
 */
export async function issueAndSendInvitation(
  c: PoolClient,
  p: CreateInviteParams & { name?: string; schoolName?: string },
): Promise<{ wasResend: boolean; emailed: boolean }> {
  const { token, wasResend } = await createInvitation(c, p);
  const acceptUrl = `${FRONTEND_URL}/convite?token=${encodeURIComponent(token)}`;
  const emailed = await sendInviteEmail(p.email, {
    name: p.name,
    schoolName: p.schoolName,
    acceptUrl,
    purpose: p.purpose,
    expiresHours: INVITE_TTL_HOURS,
  });
  return { wasResend, emailed };
}
