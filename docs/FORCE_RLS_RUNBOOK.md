# Runbook — Ativar FORCE ROW LEVEL SECURITY

Defesa em profundidade contra IDOR cross-tenant. Hoje a RLS existe mas é
**inerte** (o app conecta como dono das tabelas, que ignora RLS sem FORCE).
Este runbook liga o FORCE com segurança.

## Por que é em 2 fases

Sob FORCE, uma conexão **sem escola no contexto** enxerga 0 linhas. Vários
caminhos de sistema resolvem dados antes de haver escola no contexto
(login, /me, cron, webhooks). Se ligássemos o FORCE sem preparar esses
caminhos, a **autenticação quebraria** (resolveProfile → 0 linhas → todo mundo
403).

- **Fase A — código (JÁ DEPLOYADO):** os caminhos de sistema passaram a rodar
  em contexto superadmin (`withSystem` / `set_config app.user_role=superadmin`).
  Sob o bypass atual isso é um no-op; quando o FORCE ligar, é o que mantém o
  acesso. Arquivos: `db/withTenant.ts` (novo `withSystem`), `middleware/auth.ts`
  (`resolveProfile`), `routes/me.ts`, `routes/publicAuth.ts`, `routes/cron.ts`,
  `routes/webhooks.ts`.

- **Fase B — migração `0011_force_rls.sql`:** adiciona policy de escrita em
  `profiles` (tenant) e liga `FORCE` em todas as tabelas de tenant. **Só
  aplica quando alguém roda `npm run migrate`** (o deploy da Vercel NÃO roda
  migração automaticamente).

## Pré-condições (antes de aplicar a Fase B)

- [ ] Fase A confirmada em produção (login, /me e app funcionando normalmente).
- [ ] Janela de baixo tráfego + alguém disponível para o smoke test.
- [ ] `DATABASE_URL` de produção em mãos (não versionar).

## Aplicar

```bash
cd backend
# DATABASE_URL exportado no ambiente (não commitar)
npm run migrate
```

Saída esperada: `[migrate] OK: 0011_force_rls.sql`.

## Smoke test (rodar TODOS logo após aplicar)

Fazer com contas reais nos 3 papéis. Se qualquer item falhar → rollback.

| # | Fluxo | Esperado |
|---|-------|----------|
| 1 | Login gestor (matrícula/e-mail) + carregar app | `GET /api/me` 200, dashboard abre |
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

### Teste negativo (prova que o FORCE está valendo)

Com um token do gestor da Escola A, chamar um recurso por id da Escola B
(ex.: `GET /api/tickets/<id-de-B>`): deve retornar **404/vazio**, não os dados.

## Rollback (se algo quebrar)

Rodar no banco (psql/console Neon):

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

Isso desliga o FORCE (volta ao comportamento atual, app-layer). As policies e
o código de `withSystem` permanecem — seguros de manter. Depois, investigar o
fluxo que falhou e reaplicar.
