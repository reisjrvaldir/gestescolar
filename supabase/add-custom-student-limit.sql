-- Adicionar campo custom_student_limit na tabela schools
-- Executar no SQL Editor do Supabase Dashboard
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS custom_student_limit INT DEFAULT NULL;

-- Verificar
SELECT id, name, plan_id, custom_student_limit FROM public.schools;
