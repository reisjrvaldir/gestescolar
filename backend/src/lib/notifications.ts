import type { PoolClient } from '@neondatabase/serverless';

interface NotifyOne {
  schoolId: string;
  profileId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
}

/** Cria uma notificação para um único destinatário. */
export async function notify(c: PoolClient, n: NotifyOne): Promise<void> {
  await c.query(
    `insert into public.notifications (school_id, profile_id, type, title, body, link, entity_type, entity_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [n.schoolId, n.profileId, n.type, n.title, n.body ?? null, n.link ?? null,
     n.entityType ?? null, n.entityId ?? null],
  );
}

/** Mesma notificação para vários destinatários (ex.: todos os professores da escola). */
export async function notifyMany(
  c: PoolClient, profileIds: string[], n: Omit<NotifyOne, 'profileId'>,
): Promise<void> {
  const ids = [...new Set(profileIds)].filter(Boolean);
  if (ids.length === 0) return;
  await Promise.all(ids.map((profileId) => notify(c, { ...n, profileId })));
}
