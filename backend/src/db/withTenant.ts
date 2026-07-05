import type { PoolClient } from '@neondatabase/serverless';
import { pool } from './pool';

export interface TenantContext {
  userId: string;
  profileId: string;
  schoolId: string | null;
  role: string;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | null;
  schoolStatus?: string | null;
}

/**
 * Executa `fn` dentro de uma transação com as session vars de tenant
 * setadas (is_local = true → compatível com pooling transaction-mode).
 * A RLS do Postgres usa essas vars para isolar os dados da escola.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1, $2, true)', ['app.user_id', ctx.userId]);
    await client.query('select set_config($1, $2, true)', ['app.school_id', ctx.schoolId ?? '']);
    await client.query('select set_config($1, $2, true)', ['app.user_role', ctx.role]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Executa `fn` em uma transação com contexto de SISTEMA (app.user_role =
 * 'superadmin'), fazendo `is_superadmin()` retornar true nas policies de RLS.
 *
 * Uso EXCLUSIVO para caminhos internos/confiáveis que precisam operar fora de
 * uma escola específica e que hoje usam `pool` direto:
 *   - resolução de perfil a partir do auth_user_id (bootstrap do request);
 *   - /api/me e onboarding (usuário ainda sem escola resolvida);
 *   - login por matrícula (pré-autenticação);
 *   - cron (job cross-escola) e webhooks (liquidação por id de fatura).
 *
 * Sob o bypass atual (app conecta como dono das tabelas) isto é um no-op
 * funcional; quando a RLS for forçada (migration 0011), passa a ser o que
 * garante o acesso desses caminhos. NUNCA usar para dados vindos do usuário
 * final — esses continuam por `withTenant`, isolados por escola.
 */
export async function withSystem<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1, $2, true)', ['app.user_role', 'superadmin']);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
