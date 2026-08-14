-- =============================================================
--  0037 — RLS gap-fill v2 (pré-requisito da Fase B.2 do runbook)
--
--  Fecha as tabelas de tenant criadas DEPOIS da 0021 que ficaram sem RLS.
--  Sem isto, essas tabelas continuariam SEM isolamento mesmo depois de o app
--  passar a conectar pelo role sem bypassrls — ou seja, o enforcement teria
--  um buraco silencioso justamente nas features mais novas.
--
--  Aditivo e INÓCUO com o role atual (neondb_owner tem rolbypassrls=true):
--  aplicar agora não muda nenhum comportamento observável em produção.
--
--  Como cada tabela é acessada hoje (auditado antes de escrever as policies):
--    expense_audit_log          withTenant            → policy tenant
--    school_plan_history        withTenant            → policy tenant
--    guardian_recurring_payments withTenant + webhook  → tenant + is_superadmin
--    consent_log                withSystem (me.ts)    → tenant + is_superadmin
--    leads                      withSystem + /saas    → SOMENTE superadmin
--
--  ROLLBACK: ver bloco comentado ao final.
-- =============================================================

-- 1) expense_audit_log — trilha de auditoria de despesas (tem school_id).
alter table public.expense_audit_log enable row level security;
drop policy if exists expense_audit_log_tenant on public.expense_audit_log;
create policy expense_audit_log_tenant on public.expense_audit_log for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

-- 2) school_plan_history — histórico de alteração de planos da escola.
alter table public.school_plan_history enable row level security;
drop policy if exists school_plan_history_tenant on public.school_plan_history;
create policy school_plan_history_tenant on public.school_plan_history for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

-- 3) guardian_recurring_payments — recorrência de mensalidade no cartão.
--    O webhook do ASAAS grava aqui em contexto superadmin (identifica a escola
--    pelo provider_subscription_id), por isso is_superadmin() é necessário.
alter table public.guardian_recurring_payments enable row level security;
drop policy if exists guardian_recurring_tenant on public.guardian_recurring_payments;
create policy guardian_recurring_tenant on public.guardian_recurring_payments for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

-- 4) consent_log — aceite de Termos/Privacidade (LGPD).
--    school_id é NULLABLE: no onboarding o perfil ainda não tem escola. Todo o
--    acesso passa por withSystem (contexto superadmin), então a leitura do
--    próprio aceite continua funcionando; a cláusula de escola cobre o caso de
--    um eventual acesso por rota de escola no futuro.
alter table public.consent_log enable row level security;
drop policy if exists consent_log_tenant on public.consent_log;
create policy consent_log_tenant on public.consent_log for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

-- 5) leads — captação da landing. NÃO tem school_id (é pré-escola) e guarda
--    PII (nome, e-mail, telefone). Só a plataforma pode ler/escrever: o
--    formulário público grava via withSystem e o painel /saas lê como
--    superadmin. Nenhuma escola deve enxergar leads.
alter table public.leads enable row level security;
drop policy if exists leads_superadmin on public.leads;
create policy leads_superadmin on public.leads for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- 6) FORCE nas tabelas acima (necessário porque o app hoje conecta como dono;
--    depois da Fase B.2 o role dedicado já não é dono, mas manter FORCE torna
--    o isolamento independente de qual role conectar).
do $$
declare
  t text;
  gap_tables text[] := array[
    'expense_audit_log','school_plan_history','guardian_recurring_payments',
    'consent_log','leads'
  ];
begin
  foreach t in array gap_tables loop
    if exists (select 1 from information_schema.tables
                where table_schema='public' and table_name=t) then
      execute format('alter table public.%I force row level security', t);
    end if;
  end loop;
end$$;

-- =============================================================
--  ROLLBACK (aplicar manualmente se necessário — NÃO faz parte da migration):
--
--  do $$
--  declare t text;
--  begin
--    foreach t in array array[
--      'expense_audit_log','school_plan_history','guardian_recurring_payments',
--      'consent_log','leads'
--    ] loop
--      execute format('alter table public.%I no force row level security', t);
--      execute format('alter table public.%I disable row level security', t);
--    end loop;
--  end$$;
-- =============================================================
