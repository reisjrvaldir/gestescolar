-- Adiciona student_name desnormalizado em invoices (para exibição rápida
-- sem join, alinhado ao fluxo de cobrança por aluno).
alter table public.invoices add column if not exists student_name text;
