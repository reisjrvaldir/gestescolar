-- =============================================================
--  0019 — Campos trabalhistas no cadastro de funcionário (aditivo).
--  Aplicar manualmente no Neon SQL Editor (não rodar `npm run migrate`).
-- =============================================================

alter table public.teachers add column if not exists position       text;               -- cargo
alter table public.teachers add column if not exists admission_date  date;               -- data de admissão
alter table public.teachers add column if not exists contract_type   text;               -- clt | pj | estagio | temporario
alter table public.teachers add column if not exists weekly_hours    numeric(4,1);       -- jornada semanal (horas)
