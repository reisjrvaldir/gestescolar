-- =============================================================
--  0012 — Matérias por turma + nível nas matérias + matéria na chamada.
--  Tudo ADITIVO (não altera dados/colunas existentes).
-- =============================================================

-- Nível da matéria (para o catálogo por Infantil/Fundamental/Médio).
alter table public.subjects add column if not exists level text;

-- Turma ↔ matérias (quais matérias pertencem a cada turma).
create table if not exists public.class_subjects (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);
create index if not exists idx_class_subjects_class on public.class_subjects(class_id);
create index if not exists idx_class_subjects_school on public.class_subjects(school_id);

-- Matéria OPCIONAL na chamada (chamada por aula; null = chamada por dia).
alter table public.attendance add column if not exists subject_id uuid references public.subjects(id);

-- RLS na nova tabela (consistente com as demais tabelas de tenant).
alter table public.class_subjects enable row level security;
drop policy if exists class_subjects_tenant on public.class_subjects;
create policy class_subjects_tenant on public.class_subjects for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());
