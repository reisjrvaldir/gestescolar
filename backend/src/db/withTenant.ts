import type { PoolClient } from '@neondatabase/serverless';
import { pool } from './pool';

export interface TenantContext {
  userId: string;
  profileId: string;
  schoolId: string | null;
  role: string;
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
