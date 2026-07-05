-- =============================================================
--  0011 — FORCE ROW LEVEL SECURITY (defesa em profundidade)
--
--  Contexto: o app conecta como DONO das tabelas, que no Postgres IGNORA a
--  RLS a menos que FORCE esteja ativo. Hoje o isolamento entre escolas
--  depende só dos filtros `where school_id` na aplicação. Esta migration
--  ativa FORCE para que a RLS passe a valer também para o dono — qualquer
--  query que esqueça o filtro por escola passa a retornar 0 linhas em vez de
--  vazar dados de outra escola.
--
--  PRÉ-REQUISITO (já entregue no código antes desta migration):
--    os caminhos de sistema que usam conexão sem escola no contexto
--    (resolveProfile, /api/me, onboarding, /api/public/login-email, cron,
--    webhooks) passaram a rodar em contexto superadmin (withSystem /
--    set_config app.user_role='superadmin'). Sem isso, esta migration
--    QUEBRARIA a autenticação. Não aplicar fora de ordem.
--
--  ROLLBACK: ver 0011_rollback ao final (comentado). Em emergência, rodar
--    manualmente `alter table public.<t> no force row level security` nas
--    tabelas listadas.
-- =============================================================

-- 1) profiles: hoje só tem policy de ESCRITA para superadmin. Sob FORCE, a
--    criação de aluno/funcionário (insert em profiles via withTenant como
--    school_admin) e a edição de staff (update em profiles) precisam de uma
--    policy tenant. Consistente com as demais tabelas (papel é validado na
--    camada de rota; a RLS garante o isolamento por escola).
drop policy if exists profiles_tenant on public.profiles;
create policy profiles_tenant on public.profiles for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

-- 2) FORCE RLS em todas as tabelas de tenant (as que têm policies por escola).
--    `plans` fica de fora de propósito: é catálogo global (leitura pública).
do $$
declare
  t text;
  tenant_tables text[] := array[
    'schools','profiles','guardians','teachers','classes','subjects','students',
    'grades','attendance','invoices','payments','payment_splits','school_balances',
    'withdrawals','expenses','nuvende_accounts','nuvende_documents','subscriptions',
    'support_tickets','ticket_comments','audit_logs','lgpd_requests',
    'school_calendar','timeclock_entries','work_schedules','school_plans',
    'messages','leave_requests','staff_documents','charge_batches'
  ];
begin
  foreach t in array tenant_tables loop
    if exists (select 1 from information_schema.tables
                where table_schema='public' and table_name=t) then
      execute format('alter table public.%I force row level security', t);
    end if;
  end loop;
end$$;

-- =============================================================
--  ROLLBACK (se necessário, aplicar manualmente — NÃO faz parte da migration):
--
--  do $$
--  declare t text;
--  begin
--    foreach t in array array[
--      'schools','profiles','guardians','teachers','classes','subjects','students',
--      'grades','attendance','invoices','payments','payment_splits','school_balances',
--      'withdrawals','expenses','nuvende_accounts','nuvende_documents','subscriptions',
--      'support_tickets','ticket_comments','audit_logs','lgpd_requests',
--      'school_calendar','timeclock_entries','work_schedules','school_plans',
--      'messages','leave_requests','staff_documents','charge_batches'
--    ] loop
--      execute format('alter table public.%I no force row level security', t);
--    end loop;
--  end$$;
-- =============================================================
