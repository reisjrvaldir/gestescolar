-- Migration 0024: snapshot imutável do plano em cada fatura + histórico de plano
-- Aplicar manualmente no Neon SQL Editor (não rodar npm run migrate).
-- =============================================================================

-- 1. Colunas de snapshot na tabela invoices
--    plan_id         → FK para o plano vigente na geração (SET NULL se plano excluído)
--    plan_snapshot   → JSONB com {name, monthly_fee, enrollment_fee, version} no momento da geração
--    original_amount → valor bruto do plano ANTES do desconto
--    discount_pct    → percentual de desconto aplicado (0-100)
-- Invariante: amount = round(original_amount * (1 - discount_pct/100), 2)

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS plan_id         uuid REFERENCES public.school_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_snapshot   jsonb,
  ADD COLUMN IF NOT EXISTS original_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_pct    numeric(5,2) NOT NULL DEFAULT 0;

-- 2. Índice único parcial para idempotência na geração de mensalidades
--    Garante que não existam duas mensalidades ativas para o mesmo aluno/mês.
--    status='cancelled' fica de fora — permite reemissão após cancelamento explícito.

CREATE UNIQUE INDEX IF NOT EXISTS invoices_student_refmonth_uq
  ON public.invoices (student_id, reference_month)
  WHERE kind = 'mensalidade' AND status <> 'cancelled';

-- 3. Tabela de histórico de alterações de planos
--    Cada UPDATE em school_plans gera um registro aqui com antes/depois.

CREATE TABLE IF NOT EXISTS public.school_plan_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.school_plans(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES public.schools(id)      ON DELETE CASCADE,
  changed_by  uuid,           -- profile_id; NULL para alterações de sistema ou migração
  changed_at  timestamptz NOT NULL DEFAULT now(),
  before_data jsonb NOT NULL, -- {name, monthly_fee, enrollment_fee, status}
  after_data  jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS school_plan_history_plan_idx ON public.school_plan_history (plan_id, changed_at DESC);
