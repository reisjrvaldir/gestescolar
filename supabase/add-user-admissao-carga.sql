-- =============================================
--  GESTESCOLAR – Data de admissão e carga horária na tabela users
--  Executar no SQL Editor do Supabase Dashboard
-- =============================================

-- Adicionar colunas de admissão e carga horária
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS data_admissao  DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS carga_horaria  TEXT DEFAULT NULL
    CHECK (carga_horaria IS NULL OR carga_horaria IN ('manha','tarde','integral'));

-- Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'users'
  AND column_name IN ('data_admissao', 'carga_horaria');
