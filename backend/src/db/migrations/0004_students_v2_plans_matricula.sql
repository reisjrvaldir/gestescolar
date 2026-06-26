-- =============================================================
--  Migration 0004 — Expansão de Students + School Plans + Matrícula Global
-- =============================================================

-- ---------- Planos da escola (mensalidades configuráveis) ----------
create table public.school_plans (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  name         text not null,
  monthly_fee  numeric(10,2) not null default 0,
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_school_plans_school on public.school_plans(school_id);

alter table public.school_plans enable row level security;
create policy school_plans_select on public.school_plans for select
  using (school_id = public.current_school_id() or public.is_superadmin());
create policy school_plans_modify on public.school_plans for all
  using (school_id = public.current_school_id() or public.is_superadmin())
  with check (school_id = public.current_school_id() or public.is_superadmin());

create trigger school_plans_updated before update on public.school_plans
  for each row execute function public.set_updated_at();

-- ---------- Contador global de matrícula (sem RLS, global por ano) ----------
create table public._matricula_counter (
  year        integer primary key,
  last_value  bigint  not null default 0,
  updated_at  timestamptz not null default now()
);

-- Função atômica que retorna próxima matrícula no formato YYYY######.
-- Concurrency-safe via INSERT ON CONFLICT DO UPDATE RETURNING.
create or replace function public.next_matricula()
returns text language plpgsql as $$
declare
  v_year  integer := extract(year from now())::int;
  v_value bigint;
begin
  insert into public._matricula_counter (year, last_value)
    values (v_year, 1)
  on conflict (year) do update
    set last_value = public._matricula_counter.last_value + 1,
        updated_at = now()
  returning last_value into v_value;

  return v_year::text || lpad(v_value::text, 6, '0');
end;
$$;

-- ---------- Expansão de students ----------
alter table public.students
  add column cpf            text,
  add column father_name    text,
  add column mother_name    text,
  add column monthly_fee    numeric(10,2),
  add column plan_id        uuid references public.school_plans(id);

-- registration_number agora deve ser único globalmente
-- (limpamos qualquer NULL antigo primeiro - é seed/teste apenas)
update public.students set registration_number = 'LEGACY-' || id::text
  where registration_number is null;

create unique index uq_students_registration_global
  on public.students(registration_number);

-- ---------- Expansão de guardians (campos adicionais) ----------
alter table public.guardians
  add column relationship text default 'responsavel';  -- pai|mae|responsavel|tutor

-- índice por email pra evitar duplicar guardian no mesmo tenant
create index idx_guardians_school_email on public.guardians(school_id, email);
