-- =============================================================
--  0027 — Planejamento de aulas semanais.
--
--  Professor preenche o plano da semana; a coordenação comenta,
--  solicita ajuste ou aprova.
--
--  Ancoragem: turma + matéria. `subject_id` NULO significa "plano da
--  turma inteira" — é o caso do professor regente (infantil / fund. I),
--  que leciona todas as matérias para a mesma turma.
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor (ver memória sobre
--  migrations: NÃO rodar `npm run migrate`).
-- =============================================================

-- ── Plano da semana ──────────────────────────────────────────
create table if not exists public.lesson_plans (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  subject_id  uuid references public.subjects(id) on delete cascade,
  teacher_id  uuid not null references public.teachers(id) on delete cascade,

  -- Segunda-feira da semana planejada. Normalizada na aplicação.
  week_start  date not null,

  -- draft → submitted → (changes_requested → submitted)* → approved
  status      text not null default 'draft'
              check (status in ('draft','submitted','changes_requested','approved')),

  -- Bloco geral da semana
  objectives  text,
  contents    text,
  methodology text,
  resources   text,
  evaluation  text,
  notes       text,

  submitted_at timestamptz,
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Um plano por turma+matéria+semana. `subject_id` nulo exige índice
-- parcial próprio: no Postgres, NULLs são distintos entre si, então um
-- unique comum deixaria criar vários planos "da turma" na mesma semana.
create unique index if not exists uq_lesson_plans_subject
  on public.lesson_plans (class_id, subject_id, week_start)
  where subject_id is not null;

create unique index if not exists uq_lesson_plans_class_only
  on public.lesson_plans (class_id, week_start)
  where subject_id is null;

create index if not exists idx_lesson_plans_school  on public.lesson_plans(school_id);
create index if not exists idx_lesson_plans_teacher on public.lesson_plans(teacher_id);
create index if not exists idx_lesson_plans_week    on public.lesson_plans(school_id, week_start desc);
-- Fila da coordenação: planos aguardando revisão, mais antigos primeiro.
create index if not exists idx_lesson_plans_status  on public.lesson_plans(school_id, status, week_start desc);

-- ── Detalhamento por dia (segunda a sexta) ───────────────────
create table if not exists public.lesson_plan_days (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  plan_id    uuid not null references public.lesson_plans(id) on delete cascade,

  -- 1 = segunda … 5 = sexta (ISO, alinhado com extract(isodow)).
  weekday    smallint not null check (weekday between 1 and 5),

  content    text,
  activity   text,
  homework   text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, weekday)
);

create index if not exists idx_lesson_plan_days_plan   on public.lesson_plan_days(plan_id);
create index if not exists idx_lesson_plan_days_school on public.lesson_plan_days(school_id);

-- ── Comentários (coordenação ↔ professor) ────────────────────
create table if not exists public.lesson_plan_comments (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  plan_id    uuid not null references public.lesson_plans(id) on delete cascade,
  author_id  uuid not null references public.profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_plan_comments_plan
  on public.lesson_plan_comments(plan_id, created_at);
create index if not exists idx_lesson_plan_comments_school
  on public.lesson_plan_comments(school_id);

-- ── RLS por escola (mesmo padrão das demais tabelas de tenant) ──
alter table public.lesson_plans enable row level security;
drop policy if exists lesson_plans_tenant on public.lesson_plans;
create policy lesson_plans_tenant on public.lesson_plans for all
  using      (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

alter table public.lesson_plan_days enable row level security;
drop policy if exists lesson_plan_days_tenant on public.lesson_plan_days;
create policy lesson_plan_days_tenant on public.lesson_plan_days for all
  using      (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

alter table public.lesson_plan_comments enable row level security;
drop policy if exists lesson_plan_comments_tenant on public.lesson_plan_comments;
create policy lesson_plan_comments_tenant on public.lesson_plan_comments for all
  using      (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());
