/**
 * test-rls.mjs
 * Testa se o Row Level Security (RLS) esta bloqueando acesso
 * nao autenticado nas tabelas principais do Supabase.
 *
 * Uso: node supabase/test-rls.mjs
 */

const SUPABASE_URL = 'https://exqkzqmpbfakrjqinvnf.supabase.co';
const ANON_KEY = 'sb_publishable_6nGu3by4NOGBExiit87rMQ_nzYuJoSu';

const TABLES = ['schools', 'users', 'students', 'classes', 'invoices'];

async function testTable(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=5`;
  const res = await fetch(url, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });

  const status = res.status;
  let rows = null;
  let error = null;

  if (status === 200) {
    rows = await res.json();
  } else {
    const body = await res.json().catch(() => res.text());
    error = body;
  }

  return { table, status, rows, error };
}

async function main() {
  console.log('='.repeat(60));
  console.log('  TESTE DE RLS — Acesso sem autenticacao (anon key)');
  console.log('='.repeat(60));
  console.log();

  let allPassed = true;

  for (const table of TABLES) {
    const result = await testTable(table);

    if (result.status === 200 && Array.isArray(result.rows) && result.rows.length === 0) {
      console.log(`  [OK]   ${table.padEnd(12)} -> 0 linhas retornadas (RLS bloqueando)`);
    } else if (result.status === 200 && Array.isArray(result.rows) && result.rows.length > 0) {
      console.log(`  [FAIL] ${table.padEnd(12)} -> ${result.rows.length} linha(s) retornada(s)! RLS NAO esta bloqueando!`);
      allPassed = false;
    } else if (result.status === 401 || result.status === 403) {
      console.log(`  [OK]   ${table.padEnd(12)} -> HTTP ${result.status} (acesso negado)`);
    } else if (result.status === 404) {
      console.log(`  [SKIP] ${table.padEnd(12)} -> HTTP 404 (tabela nao encontrada)`);
    } else {
      console.log(`  [WARN] ${table.padEnd(12)} -> HTTP ${result.status}`);
      if (result.error) {
        const msg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
        console.log(`         Detalhe: ${msg}`);
      }
    }
  }

  console.log();
  console.log('-'.repeat(60));
  if (allPassed) {
    console.log('  RESULTADO: Todas as tabelas estao protegidas por RLS.');
  } else {
    console.log('  RESULTADO: ATENCAO — Algumas tabelas NAO estao protegidas!');
  }
  console.log('-'.repeat(60));
}

main().catch((err) => {
  console.error('Erro ao executar teste:', err);
  process.exit(1);
});
