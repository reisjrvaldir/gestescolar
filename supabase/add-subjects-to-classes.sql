-- =============================================
--  Adiciona coluna "subjects" (JSONB) à tabela classes
--  Armazena as matérias selecionadas por turma
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'subjects'
  ) THEN
    ALTER TABLE public.classes ADD COLUMN subjects JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Coluna "subjects" adicionada à tabela classes.';
  ELSE
    RAISE NOTICE 'Coluna "subjects" já existe.';
  END IF;
END $$;

SELECT '✅ Coluna subjects adicionada!' AS resultado;
