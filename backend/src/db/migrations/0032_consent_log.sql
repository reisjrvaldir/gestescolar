-- =============================================================
--  0032 — Tabela consent_log (aceite de Termos / Privacidade).
--
--  Registra consentimento inicial e reanálise de cada usuário.
--  As colunas ip_hash e user_agent_hash armazenam SHA-256 (hex)
--  do IP e User-Agent, nunca os valores brutos.
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

create table if not exists public.consent_log (
  id              uuid         primary key default gen_random_uuid(),
  profile_id      uuid         not null references public.profiles(id) on delete cascade,
  school_id       uuid         references public.schools(id) on delete set null,
  terms_version   text         not null,
  privacy_version text         not null,
  ip_hash         text,
  user_agent_hash text,
  purpose         text         not null default 'initial',
  accepted_at     timestamptz  not null default now()
);

-- Índice para a query "último aceite deste profile" em me.ts
create index if not exists idx_consent_log_profile
  on public.consent_log(profile_id, accepted_at desc);
