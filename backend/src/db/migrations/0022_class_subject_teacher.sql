-- =============================================================
--  0022 — Professor por matéria na turma (vários professores por turma).
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

alter table public.class_subjects
  add column if not exists teacher_id uuid references public.teachers(id);

create index if not exists idx_class_subjects_teacher on public.class_subjects(teacher_id);
