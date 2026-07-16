-- Adiciona tipo de avaliação (AV1, AV2, Prova Final) à tabela de notas
alter table public.grades
  add column if not exists assessment_type text not null default 'av1'
    check (assessment_type in ('av1', 'av2', 'final'));

-- Configurações de nota mínima por escola
create table if not exists public.school_grade_settings (
  school_id             uuid primary key references public.schools(id) on delete cascade,
  passing_grade         numeric(4,2) not null default 7.0,
  final_passing_grade   numeric(4,2) not null default 5.0,
  updated_at            timestamptz not null default now()
);

alter table public.school_grade_settings enable row level security;
create policy grade_settings_tenant on public.school_grade_settings for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

insert into public._migrations (name) values ('0016_grades_assessment_type.sql') on conflict (name) do nothing;
