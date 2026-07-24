-- =============================================================
--  0023 — Contas a Pagar: soft-delete (lixeira 60 dias),
--         edição com log de auditoria e parcelas (cartão de crédito).
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

-- Soft delete + registro de pagamento
alter table public.expenses
  add column if not exists paid_at    timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id);

-- Parcelas (compra parcelada no cartão de crédito).
-- installment_group_id agrupa as N parcelas de uma mesma compra.
alter table public.expenses
  add column if not exists installment_group_id uuid,
  add column if not exists installment_number   integer,
  add column if not exists installment_total    integer;

create index if not exists idx_expenses_deleted_at on public.expenses(school_id, deleted_at);
create index if not exists idx_expenses_group      on public.expenses(installment_group_id);

-- Log de auditoria (create, update, pay, delete, restore, purge)
create table if not exists public.expense_audit_log (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  expense_id uuid not null,
  action     text not null,
  actor_id   uuid references public.profiles(id),
  actor_role text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_expense_audit_school  on public.expense_audit_log(school_id, created_at desc);
create index if not exists idx_expense_audit_expense on public.expense_audit_log(expense_id, created_at desc);
