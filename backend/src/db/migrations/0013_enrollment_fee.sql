-- Valor de matrícula por plano da escola (cobrado uma vez, no cadastro do aluno).
alter table public.school_plans
  add column if not exists enrollment_fee numeric(10,2) not null default 0;
