-- =============================================================
--  0025 — Credenciais iniciais seguras (elimina senha universal).
--
--  Substitui a senha fixa "Escola@2026" por um fluxo de convite individual:
--  token aleatório, de uso único, com expiração curta. O token cru NUNCA é
--  gravado — só o hash SHA-256. Auditoria sem token nem senha.
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor (NÃO rodar npm run migrate).
-- =============================================================

-- ── 1. Marcador de ativação de acesso no profile ──
-- access_activated_at = quando o usuário definiu a própria senha via convite.
alter table public.profiles
  add column if not exists access_activated_at timestamptz;

-- ── 2. Convites individuais ──
create table if not exists public.user_invitations (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  auth_user_id    text not null,                       -- id no provedor (neon_auth)
  email           text not null,
  token_hash      text not null,                       -- SHA-256 hex do token; token cru NUNCA é gravado
  purpose         text not null default 'invite'  check (purpose in ('invite','recovery')),
  status          text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  created_by      uuid references public.profiles(id), -- gestor que enviou
  created_by_email text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  revoked_at      timestamptz
);

create index if not exists idx_invitations_school  on public.user_invitations(school_id, created_at desc);
create index if not exists idx_invitations_profile on public.user_invitations(profile_id, created_at desc);
create index if not exists idx_invitations_token   on public.user_invitations(token_hash);
create index if not exists idx_invitations_status  on public.user_invitations(school_id, status);

-- ── 3. Auditoria de convites (SEM token, SEM senha) ──
create table if not exists public.invitation_audit_log (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  invitation_id    uuid,
  action           text not null check (action in ('sent','resent','accepted','revoked','expired')),
  actor_profile_id uuid references public.profiles(id),
  actor_email      text,
  target_email     text,
  at               timestamptz not null default now()
);

create index if not exists idx_invite_audit_school on public.invitation_audit_log(school_id, at desc);

-- ── 4. RLS (mesmo padrão multi-tenant das demais tabelas) ──
alter table public.user_invitations   enable row level security;
alter table public.invitation_audit_log enable row level security;

drop policy if exists user_invitations_tenant on public.user_invitations;
create policy user_invitations_tenant on public.user_invitations for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

drop policy if exists invitation_audit_tenant on public.invitation_audit_log;
create policy invitation_audit_tenant on public.invitation_audit_log for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

-- ── 5. REVOGAÇÃO do padrão inseguro (requisito 10) ──
-- Embaralha a senha de TODA conta credential ainda NÃO ativada, invalidando o
-- "Escola@2026". O valor gravado não tem formato scrypt válido → login falha e
-- o usuário precisa do novo convite/recuperação. Contas já ativadas (o usuário
-- trocou a senha) NÃO são tocadas. Detecta o nome/casing das colunas do
-- neon_auth dinamicamente (varia entre versões do Better Auth).
do $$
declare
  tbl     text;
  usercol text;
  provcol text;
  n       integer;
begin
  select table_name into tbl
    from information_schema.tables
   where table_schema = 'neon_auth' and lower(table_name) in ('account','accounts')
   limit 1;
  if tbl is null then
    raise notice '[0025] tabela neon_auth.account não encontrada — revogação ignorada';
    return;
  end if;

  select case
           when exists (select 1 from information_schema.columns
                         where table_schema='neon_auth' and table_name=tbl and column_name='userId')  then '"userId"'
           when exists (select 1 from information_schema.columns
                         where table_schema='neon_auth' and table_name=tbl and column_name='user_id') then 'user_id'
         end into usercol;
  select case
           when exists (select 1 from information_schema.columns
                         where table_schema='neon_auth' and table_name=tbl and column_name='providerId')  then '"providerId"'
           when exists (select 1 from information_schema.columns
                         where table_schema='neon_auth' and table_name=tbl and column_name='provider_id') then 'provider_id'
         end into provcol;

  if usercol is null or provcol is null then
    raise notice '[0025] colunas do neon_auth não reconhecidas — revogação ignorada';
    return;
  end if;

  execute format($f$
    update neon_auth.%1$I a
       set password = 'revoked-' || gen_random_uuid()::text || gen_random_uuid()::text
      from public.profiles p
     where p.auth_user_id = a.%2$s
       and a.%3$s = 'credential'
       and p.access_activated_at is null
       and coalesce(p.password_change_required, true) = true
  $f$, tbl, usercol, provcol);
  get diagnostics n = row_count;
  raise notice '[0025] revogação aplicada: % conta(s) com senha padrão invalidada(s)', n;
end $$;
