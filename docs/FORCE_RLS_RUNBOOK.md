# Runbook — Enforcement de RLS (isolamento entre escolas)

Defesa em profundidade contra IDOR cross-tenant. Hoje a RLS existe (policies em
todas as tabelas) mas é **inerte**. Este runbook a torna efetiva.

## ⚠️ Achado do ensaio (2026-07-05) — FORCE RLS sozinho NÃO resolve

Rodamos um ensaio (dry-run, em transação revertida) aplicando `FORCE ROW LEVEL
SECURITY` contra o banco real e testando o isolamento. Resultado: **o
isolamento continuou falhando** — a escola A ainda enxergava alunos da escola B.

Causa raiz confirmada: o role de conexão **`neondb_owner` tem
`rolbypassrls = true`**. No Postgres, roles com **BYPASSRLS** (ou superuser)
**ignoram a RLS mesmo com FORCE**. FORCE só remove a isenção do *dono da
tabela*, não a de um role BYPASSRLS.

```
rolname=neondb_owner  rolsuper=false  rolbypassrls=true   ← ignora RLS
current_school_id() e is_superadmin() funcionam certo; o problema é o role.
```

**Conclusão:** para a RLS valer, o app precisa conectar por um **role dedicado
SEM bypassrls e que não seja dono das tabelas**. Só então as policies (e o
FORCE) passam a ser aplicados.

Enquanto isso, o isolamento efetivo em produção é o **filtro por `school_id` na
aplicação** — auditado e corrigido em todas as rotas (ver `PENTEST_2026-07-04`).

---

## Plano correto (3 passos)

### Fase A — código de contexto de sistema  ✅ JÁ DEPLOYADO

Caminhos de sistema (que resolvem dados antes de haver escola no contexto)
rodam em contexto superadmin, para continuarem funcionando quando a RLS valer.
`withSystem` em: `middleware/auth.ts` (resolveProfile), `routes/me.ts`,
`routes/publicAuth.ts`, `routes/cron.ts`, `routes/webhooks.ts`.

### Fase B.1 — migração `0011` (policy de profiles + FORCE)  ⏳

`0011_force_rls.sql` adiciona a policy de **escrita tenant em `profiles`** (que
faltava; senão criar aluno/funcionário quebra) e liga FORCE. Aplicar via
`npm run migrate`. **Sozinha ainda não isola** (por causa do BYPASSRLS), mas é
pré-requisito e é inócua com o role atual.

### Fase B.2 — role de aplicação SEM bypassrls  ⏳ (é o que efetivamente isola)

Criar um role dedicado e apontar o app para ele. As migrações continuam
rodando como `neondb_owner` (dono, para DDL); só a aplicação troca de role.

```sql
-- Rodar como neondb_owner (tem createrole). Trocar a senha por uma forte.
create role gestescolar_app login password '<SENHA_FORTE>'
  nosuperuser nocreatedb nocreaterole noinherit nobypassrls;

grant usage on schema public to gestescolar_app;
grant select, insert, update, delete on all tables in schema public to gestescolar_app;
grant usage, select on all sequences in schema public to gestescolar_app;
grant execute on all functions in schema public to gestescolar_app;

-- Objetos futuros criados pelo owner ficam acessíveis ao app automaticamente:
alter default privileges for role neondb_owner in schema public
  grant select, insert, update, delete on tables to gestescolar_app;
alter default privileges for role neondb_owner in schema public
  grant usage, select on sequences to gestescolar_app;
alter default privileges for role neondb_owner in schema public
  grant execute on functions to gestescolar_app;
```

Como `gestescolar_app` **não** é dono nem tem bypassrls, a RLS passa a valer
para ele. O bypass do superadmin continua funcionando (é via
`is_superadmin()` na policy, não via atributo de role) — então `withSystem` e
o painel Super Admin seguem OK.

Depois:
1. Montar a nova `DATABASE_URL` com `gestescolar_app` + a senha.
2. Atualizar a env `DATABASE_URL` **na Vercel (produção)** e redeployar.
3. Rodar o smoke test abaixo.

> Nota Neon: dá para criar o role por SQL (acima) ou pelo painel do Neon
> (Roles → New Role), que já entrega a connection string pronta.

## Smoke test (após a Fase B.2)

Com contas reais nos 3 papéis. Se qualquer item falhar → rollback.

| # | Fluxo | Esperado |
|---|-------|----------|
| 1 | Login gestor + carregar app | `GET /api/me` 200, dashboard abre |
| 2 | Login responsável | vê só o(s) próprio(s) filho(s) |
| 3 | Login professor + registrar ponto | ok dentro da jornada |
| 4 | Criar aluno (gestor) | 201 + matrícula + senha temporária |
| 5 | Criar funcionário (gestor) | 201 |
| 6 | Editar funcionário (muda cargo) | 200 (update em profiles funciona) |
| 7 | Financeiro: faturas / inadimplência | carrega para gestor/financeiro |
| 8 | Cobrança avulsa / PIX de fatura | gera cobrança |
| 9 | Onboarding de nova escola (signup) | cria escola + admin |
| 10 | Super Admin `/saas` (dashboard + escolas) | vê todas as escolas |
| 11 | Webhook de pagamento (sandbox) | fatura marcada paga |
| 12 | Cron `/api/cron/overdue-invoices` (com CRON_SECRET) | atualiza vencidas |

### Teste negativo (prova o isolamento)

Repetir o ensaio (dry-run) já conectando como `gestescolar_app`: a escola A
deve ver **só** os próprios alunos e **0** da escola B; insert de profile na
escola B deve ser bloqueado pela policy (`with check`).

## Rollback

O gatilho de tudo é a `DATABASE_URL`. Para reverter, basta **voltar a
`DATABASE_URL` para `neondb_owner`** na Vercel e redeployar — a RLS volta a ser
inócua (comportamento atual, isolamento por app-layer). As policies, o FORCE e
o `withSystem` permanecem (seguros de manter).

Para desligar o FORCE (opcional):

```sql
do $$
declare t text;
begin
  foreach t in array array[
    'schools','profiles','guardians','teachers','classes','subjects','students',
    'grades','attendance','invoices','payments','payment_splits','school_balances',
    'withdrawals','expenses','nuvende_accounts','nuvende_documents','subscriptions',
    'support_tickets','ticket_comments','audit_logs','lgpd_requests',
    'school_calendar','timeclock_entries','work_schedules','school_plans',
    'messages','leave_requests','staff_documents','charge_batches'
  ] loop
    execute format('alter table public.%I no force row level security', t);
  end loop;
end$$;
```
