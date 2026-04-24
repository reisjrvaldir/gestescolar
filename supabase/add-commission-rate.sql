-- Adiciona coluna de taxa de comissão por escola (padrão 3%)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 3.00;

-- Verificar
SELECT id, name, commission_rate FROM public.schools;
