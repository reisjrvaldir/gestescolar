-- =============================================
--  GESTESCOLAR – Colunas de acesso do aluno
--  Executar no SQL Editor do Supabase Dashboard
--  ATENÇÃO: Usar apenas ALTER TABLE IF NOT EXISTS
-- =============================================

-- Adicionar colunas de acesso/login na tabela students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS access_link    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS login_matricula TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS login_senha    TEXT DEFAULT NULL;

-- Verificar resultado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'students'
  AND column_name IN ('access_link', 'login_matricula', 'login_senha');
