-- =============================================================
--  Migration 0007 — Security + Data Integrity Fixes
-- =============================================================

-- Coluna subject (texto livre) na tabela grades para categorizar notas por matéria.
-- Antes as notas eram salvas sem matéria, causando sobrescrita entre matérias diferentes.
alter table public.grades
  add column if not exists subject text;

create index if not exists idx_grades_class_period_subject
  on public.grades(class_id, period, subject);
