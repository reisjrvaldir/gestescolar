-- =============================================================
--  Cobranças avulsas, assinatura SaaS (checkout) e vínculos de pagamento.
--  Aditivo e idempotente — não altera a lógica existente.
-- =============================================================

-- Campanhas de cobrança avulsa (festas, eventos, materiais...) — vinculadas
-- a todos os alunos da escola ou a uma turma específica.
create table if not exists public.charge_batches (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  title        text not null,
  description  text,
  amount       numeric(10,2) not null,
  due_date     date not null,
  scope        text not null default 'all',   -- all | class
  class_id     uuid references public.classes(id) on delete set null,
  created_by   uuid references public.profiles(id),
  invoices_count integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_charge_batches_school on public.charge_batches(school_id);
alter table public.charge_batches enable row level security;
drop policy if exists charge_batches_tenant on public.charge_batches;
create policy charge_batches_tenant on public.charge_batches for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());
create trigger trg_charge_batches_updated before update on public.charge_batches
  for each row execute function public.set_updated_at();

-- Fatura: tipo (mensalidade regular x cobrança avulsa) e vínculo à campanha.
alter table public.invoices
  add column if not exists kind text not null default 'mensalidade',  -- mensalidade | avulsa
  add column if not exists batch_id uuid references public.charge_batches(id) on delete set null;

-- Escola como PAGADORA da assinatura SaaS (distinto da subconta receptora
-- de split, que já existe em schools.asaas_wallet_id).
alter table public.schools
  add column if not exists asaas_billing_customer_id text;

-- Checkout pendente da assinatura (link de pagamento hospedado ASAAS).
alter table public.subscriptions
  add column if not exists checkout_url text,
  add column if not exists installment_count integer;

-- Pagamento pode ser de uma assinatura SaaS (não vinculado a uma fatura de aluno).
alter table public.payments
  add column if not exists subscription_id uuid references public.subscriptions(id);
