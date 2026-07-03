// Hook central de autorização do módulo Super Admin.
// - Papel obrigatório: 'superadmin' (roles admin_saas/suporte_saas ficam reservados
//   para expansão futura sem quebrar contratos existentes).
// - Toda action crítica (prorrogar acesso, suspender, alterar plano, impersonar)
//   deve chamar logSaasAction() além de bater no endpoint correspondente.
//   Hoje o log fica em memória (mock) — quando os endpoints existirem, é só
//   trocar para POST /api/saas/audit-logs.
import { useMe } from '@/auth/AuthGate';

export type SaasRole = 'superadmin';

export function useSaasAdmin() {
  const me = useMe();
  const isSuperAdmin = me?.role === 'superadmin';
  return { me, isSuperAdmin };
}

export interface SaasAuditLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity?: string;
  entity_id?: string;
  details?: string;
  ip?: string;
}

const memoryLog: SaasAuditLog[] = [];

export function logSaasAction(entry: Omit<SaasAuditLog, 'id' | 'at'>) {
  const record: SaasAuditLog = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  memoryLog.unshift(record);
  return record;
}

export function readSaasAuditLog(): SaasAuditLog[] {
  return memoryLog;
}
