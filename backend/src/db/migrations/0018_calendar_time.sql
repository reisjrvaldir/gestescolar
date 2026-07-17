-- =============================================================
--  0018 — Horário nos eventos do calendário escolar (aditivo).
--  Aplicar manualmente no Neon SQL Editor (não rodar `npm run migrate`).
-- =============================================================

alter table public.school_calendar add column if not exists start_time time;
alter table public.school_calendar add column if not exists end_time   time;
