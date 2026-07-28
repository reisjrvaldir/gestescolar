import { randomBytes, scryptSync } from 'crypto';
import type { PoolClient } from '@neondatabase/serverless';

/**
 * Hash de senha no formato do Better Auth (Neon Auth): scrypt N=16384 r=16 p=1
 * dkLen=64, salt de 16 bytes em hex usado como string, saída "salt:hash" (hex).
 * Compatível com a verificação do provedor — permite definir/redefinir a senha
 * de um usuário direto na tabela neon_auth.account sem API administrativa.
 */
export function betterAuthHash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password.normalize('NFKC'), salt, 64, {
    N: 16384, r: 16, p: 1, maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${key.toString('hex')}`;
}

/** Resolve dinamicamente o nome/casing da tabela e colunas do Better Auth. */
async function resolveAccountSchema(c: PoolClient): Promise<
  | { table: string; userCol: string; provCol: string }
  | { error: 'schema_mismatch' }
> {
  const tbl = await c.query(
    `select table_name from information_schema.tables
      where table_schema='neon_auth' and lower(table_name) in ('account','accounts') limit 1`,
  );
  if (tbl.rows.length === 0) return { error: 'schema_mismatch' };
  const table: string = tbl.rows[0].table_name;

  const cols = await c.query(
    `select column_name from information_schema.columns
      where table_schema='neon_auth' and table_name=$1`,
    [table],
  );
  const names: string[] = cols.rows.map((r: any) => r.column_name);
  const userCol = names.includes('userId') ? '"userId"' : names.includes('user_id') ? 'user_id' : null;
  const provCol = names.includes('providerId') ? '"providerId"' : names.includes('provider_id') ? 'provider_id' : null;
  if (!userCol || !provCol || !names.includes('password')) return { error: 'schema_mismatch' };
  return { table, userCol, provCol };
}

/**
 * Define a senha (real, escolhida pelo usuário) de uma conta credential do
 * Better Auth, gravando o hash scrypt diretamente. Usado no aceite de convite.
 * Retorna true se atualizou; false se não há conta credential para o usuário.
 */
export async function setAccountPassword(
  c: PoolClient,
  authUserId: string,
  plainPassword: string,
): Promise<boolean> {
  const schema = await resolveAccountSchema(c);
  if ('error' in schema) throw Object.assign(new Error('schema_mismatch'), { code: 'schema_mismatch' });
  const { table, userCol, provCol } = schema;

  const acc = await c.query(
    `select id from neon_auth."${table}" where ${userCol}=$1 and ${provCol}='credential' limit 1`,
    [authUserId],
  );
  if (acc.rows.length === 0) return false;

  await c.query(
    `update neon_auth."${table}" set password=$2 where id=$1`,
    [acc.rows[0].id, betterAuthHash(plainPassword)],
  );
  return true;
}
