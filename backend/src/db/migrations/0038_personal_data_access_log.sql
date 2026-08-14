-- Trilha de auditoria LGPD: registra cada acesso a dado pessoal sensível
-- via POST /api/personal-data/reveal. Criada como migration formal para
-- garantir reprodutibilidade em novos ambientes.

create table if not exists public.personal_data_access_log (
  id                    uuid        primary key default gen_random_uuid(),
  school_id             uuid        not null references public.schools(id) on delete cascade,
  accessed_by_profile_id uuid       not null references public.profiles(id),
  entity_type           text        not null,
  entity_id             uuid        not null,
  entity_name           text,
  field_name            text        not null,
  justification         text        not null,
  revealed_at           timestamptz not null default now()
);

create index if not exists idx_personal_data_access_school
  on public.personal_data_access_log(school_id, revealed_at desc);

alter table public.personal_data_access_log enable row level security;

create policy personal_data_access_log_tenant
  on public.personal_data_access_log
  for all
  using (
    public.is_superadmin()
    or school_id = public.current_school_id()
  )
  with check (
    public.is_superadmin()
    or school_id = public.current_school_id()
  );

alter table public.personal_data_access_log force row level security;
