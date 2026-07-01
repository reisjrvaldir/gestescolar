-- =============================================================
--  Campos financeiros para o módulo Financeiro puxar dados reais.
--  Aditivo e idempotente — não altera a lógica existente.
-- =============================================================

-- Categoria da despesa (Contas a pagar): Infraestrutura, Pessoal, Materiais, Serviços...
alter table public.expenses
  add column if not exists category text;

-- Mês de competência/referência da cobrança (ex.: '2025-05' para "Mai/2025").
-- Usado por "A receber" e "Inadimplência" para agrupar por mês.
alter table public.invoices
  add column if not exists reference_month text;

-- Índices de apoio aos relatórios financeiros.
create index if not exists idx_invoices_status_due on public.invoices(school_id, status, due_date);
create index if not exists idx_expenses_status_due on public.expenses(school_id, status, due_date);
