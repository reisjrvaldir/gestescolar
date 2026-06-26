import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido');

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('[migrate] conectado ao Neon');

  // Tabela de controle de migrations aplicadas
  await client.query(`
    create table if not exists public._migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`);

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await client.query('select name from public._migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] já aplicada: ${file}`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`[migrate] aplicando: ${file} ...`);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into public._migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`[migrate] OK: ${file}`);
    } catch (err) {
      await client.query('rollback');
      console.error(`[migrate] FALHOU: ${file}`);
      throw err;
    }
  }

  const tables = await client.query(
    `select table_name from information_schema.tables where table_schema='public' order by table_name`,
  );
  console.log('[migrate] tabelas em public:', tables.rows.map((r) => r.table_name).join(', '));
  await client.end();
  console.log('[migrate] concluído.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
