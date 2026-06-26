-- =============================================================
--  Migration 0006 — Forçar troca de senha no primeiro acesso
-- =============================================================

alter table public.profiles
  add column password_change_required boolean not null default false;

create index idx_profiles_pwd_change on public.profiles(password_change_required)
  where password_change_required = true;
