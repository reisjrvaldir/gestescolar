-- =============================================================
--  0036 — Pagamento recorrente no cartão, cadastrado pelo responsável.
--
--  O cartão NUNCA passa pelo nosso backend: criamos uma assinatura no
--  ASAAS e o responsável cadastra o cartão no checkout hospedado deles.
--  Guardamos só o id da assinatura — nada de dado de cartão aqui.
--
--  Uma linha por ALUNO (não por responsável): a mensalidade é do aluno,
--  e um responsável com dois filhos pode querer recorrência só para um.
--
--  status:
--    pending   — assinatura criada, aguardando o cartão ser cadastrado
--    active    — cobrando mensalmente
--    failed    — última cobrança recusada (a fatura do mês volta para PIX;
--                a recorrência segue ativa para o mês seguinte)
--    cancelled — desligada pelo responsável
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

create table if not exists public.guardian_recurring_payments (
  id                       uuid primary key default gen_random_uuid(),
  school_id                uuid not null references public.schools(id) on delete cascade,
  guardian_id              uuid not null references public.guardians(id) on delete cascade,
  student_id               uuid not null references public.students(id) on delete cascade,
  provider                 text not null default 'asaas',
  provider_subscription_id text,
  status                   text not null default 'pending',
  amount                   numeric(10,2),
  last_error               text,
  last_charged_at          timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Um aluno não pode ter duas recorrências ativas: isso geraria cobrança
  -- duplicada da mesma mensalidade todo mês.
  constraint guardian_recurring_unique_student unique (student_id)
);

create index if not exists idx_guardian_recurring_school
  on public.guardian_recurring_payments (school_id);

create index if not exists idx_guardian_recurring_guardian
  on public.guardian_recurring_payments (guardian_id);

-- Busca pelo id da assinatura ao processar o webhook do provedor.
create index if not exists idx_guardian_recurring_subscription
  on public.guardian_recurring_payments (provider_subscription_id);
