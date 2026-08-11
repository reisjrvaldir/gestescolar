import type { PoolClient } from '@neondatabase/serverless';

interface AuditEntry {
  schoolId: string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: object;
}

/** Grava uma linha em audit_logs. Falha nunca deve derrubar a ação principal
 *  que está sendo auditada — quem chama decide se quer aguardar ou não, mas
 *  o próprio insert não lança: uma falha de auditoria não pode impedir o
 *  usuário de enviar a mensagem/pagar a fatura/etc. */
export async function audit(c: PoolClient, e: AuditEntry): Promise<void> {
  try {
    await c.query(
      `insert into public.audit_logs (school_id, user_id, action, entity_type, entity_id, metadata)
       values ($1,$2,$3,$4,$5,$6)`,
      [e.schoolId, e.userId, e.action, e.entityType ?? null, e.entityId ?? null,
       e.metadata ? JSON.stringify(e.metadata) : null],
    );
  } catch (err: any) {
    console.error('[audit] falha ao gravar log (ação principal segue normalmente):', err?.message ?? err);
  }
}
