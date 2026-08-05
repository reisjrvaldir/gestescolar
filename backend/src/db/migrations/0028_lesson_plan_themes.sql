-- =============================================================
--  0028 — Temas da semana definidos pela coordenação.
--
--  A coordenação registra um ou mais temas para uma semana; os
--  professores veem esses temas ao montar o planejamento daquela
--  semana e planejam em cima deles.
--
--  Escopo é a escola + a semana (não a turma): temas institucionais
--  como "Semana da Água" valem para todas as turmas.
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

create table if not exists public.lesson_plan_themes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,

  -- Segunda-feira da semana. Normalizada na aplicação.
  week_start  date not null,

  title       text not null,
  description text,

  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- Consulta principal: temas de uma semana da escola.
create index if not exists idx_lesson_plan_themes_week
  on public.lesson_plan_themes(school_id, week_start);

-- Evita o mesmo tema repetido na mesma semana (ex.: duplo clique no salvar).
create unique index if not exists uq_lesson_plan_themes_title
  on public.lesson_plan_themes(school_id, week_start, lower(title));

alter table public.lesson_plan_themes enable row level security;
drop policy if exists lesson_plan_themes_tenant on public.lesson_plan_themes;
create policy lesson_plan_themes_tenant on public.lesson_plan_themes for all
  using      (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());
