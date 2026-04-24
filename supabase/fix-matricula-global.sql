-- =============================================================
--  GESTESCOLAR — Matrícula GLOBAL única (v55)
--
--  Resolve o bug em que escolas diferentes geravam a mesma
--  matrícula porque cada uma lia apenas os alunos do seu próprio
--  escopo (RLS). Soluciona em três camadas:
--
--    1. Renumera duplicatas existentes (mantém a mais antiga).
--    2. UNIQUE constraint em students.matricula e users.matricula
--       → garantia de banco contra race conditions.
--    3. RPC `next_matricula()` com SECURITY DEFINER que lê o
--       maior número de students + users globalmente, ignorando
--       RLS → todas as escolas compartilham o mesmo pool.
--
--  Execute no SQL Editor do Supabase.
-- =============================================================

-- ── 1. RENUMERAR DUPLICATAS EXISTENTES ──────────────────────
-- Mantém a matrícula mais antiga e renumera as mais recentes.
DO $$
DECLARE
  dup RECORD;
  new_mat TEXT;
  year_prefix TEXT;
  max_seq INT;
BEGIN
  FOR dup IN
    SELECT id, matricula
    FROM (
      SELECT id, matricula,
        ROW_NUMBER() OVER (PARTITION BY matricula ORDER BY created_at ASC, id ASC) AS rn
      FROM public.students
      WHERE matricula IS NOT NULL
    ) sub
    WHERE rn > 1
  LOOP
    year_prefix := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

    SELECT GREATEST(
      COALESCE((
        SELECT MAX(CAST(SUBSTRING(matricula FROM 5) AS INT))
        FROM public.students
        WHERE matricula ~ ('^' || year_prefix || '[0-9]{6}$')
      ), 0),
      COALESCE((
        SELECT MAX(CAST(SUBSTRING(matricula FROM 5) AS INT))
        FROM public.users
        WHERE matricula ~ ('^' || year_prefix || '[0-9]{6}$')
      ), 0)
    ) INTO max_seq;

    new_mat := year_prefix || LPAD((max_seq + 1)::TEXT, 6, '0');

    UPDATE public.students SET matricula = new_mat WHERE id = dup.id;

    -- Atualiza também o login_matricula se existir
    UPDATE public.students SET login_matricula = new_mat WHERE id = dup.id AND login_matricula IS NOT NULL;

    -- Atualiza o usuário do responsável vinculado a esse aluno
    UPDATE public.users SET matricula = new_mat
    WHERE student_id = dup.id AND role = 'pai' AND matricula IS NOT NULL;

    RAISE NOTICE 'Renumerado aluno %: % → %', dup.id, dup.matricula, new_mat;
  END LOOP;
END $$;

-- Mesma limpeza para users (professores que porventura tenham matrícula duplicada)
DO $$
DECLARE
  dup RECORD;
  new_mat TEXT;
  year_prefix TEXT;
  max_seq INT;
BEGIN
  FOR dup IN
    SELECT id, matricula
    FROM (
      SELECT id, matricula,
        ROW_NUMBER() OVER (PARTITION BY matricula ORDER BY created_at ASC, id ASC) AS rn
      FROM public.users
      WHERE matricula IS NOT NULL AND role IN ('professor','gestor','administrativo','superadmin')
    ) sub
    WHERE rn > 1
  LOOP
    year_prefix := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

    SELECT GREATEST(
      COALESCE((
        SELECT MAX(CAST(SUBSTRING(matricula FROM 5) AS INT))
        FROM public.students
        WHERE matricula ~ ('^' || year_prefix || '[0-9]{6}$')
      ), 0),
      COALESCE((
        SELECT MAX(CAST(SUBSTRING(matricula FROM 5) AS INT))
        FROM public.users
        WHERE matricula ~ ('^' || year_prefix || '[0-9]{6}$')
      ), 0)
    ) INTO max_seq;

    new_mat := year_prefix || LPAD((max_seq + 1)::TEXT, 6, '0');

    UPDATE public.users SET matricula = new_mat WHERE id = dup.id;

    RAISE NOTICE 'Renumerado usuário %: % → %', dup.id, dup.matricula, new_mat;
  END LOOP;
END $$;

-- ── 2. UNIQUE CONSTRAINTS ───────────────────────────────────
-- Garantia forte de unicidade a nível de banco.
-- Ignora NULLs (NULLS NOT DISTINCT é pg 15+; omitido para compat).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'students_matricula_unique'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_matricula_unique UNIQUE (matricula);
  END IF;
END $$;

-- users.matricula: parcial — só professores/gestores usam
-- (pais herdam a matrícula do aluno e não devem bloquear o pool)
DROP INDEX IF EXISTS users_matricula_unique_staff;
CREATE UNIQUE INDEX users_matricula_unique_staff
  ON public.users (matricula)
  WHERE role IN ('professor','gestor','administrativo','superadmin')
    AND matricula IS NOT NULL;

-- ── 3. FUNÇÃO RPC: PRÓXIMA MATRÍCULA GLOBAL ─────────────────
-- SECURITY DEFINER permite ler todas as linhas ignorando RLS,
-- garantindo que a sequência seja global entre todas as escolas.

CREATE OR REPLACE FUNCTION public.next_matricula()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_prefix TEXT;
  max_seq INT;
BEGIN
  year_prefix := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT GREATEST(
    COALESCE((
      SELECT MAX(CAST(SUBSTRING(matricula FROM 5) AS INT))
      FROM public.students
      WHERE matricula ~ ('^' || year_prefix || '[0-9]{6}$')
    ), 0),
    COALESCE((
      SELECT MAX(CAST(SUBSTRING(matricula FROM 5) AS INT))
      FROM public.users
      WHERE matricula ~ ('^' || year_prefix || '[0-9]{6}$')
        AND role IN ('professor','gestor','administrativo','superadmin')
    ), 0)
  ) INTO max_seq;

  RETURN year_prefix || LPAD((max_seq + 1)::TEXT, 6, '0');
END;
$$;

-- Permite qualquer usuário autenticado chamar a função
REVOKE ALL ON FUNCTION public.next_matricula() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_matricula() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_matricula() TO anon;

-- ── 4. FUNÇÃO RPC: BUSCAR E-MAIL POR MATRÍCULA ──────────────
-- Permite que o fluxo de login converta uma matrícula em e-mail
-- de Auth ANTES da autenticação (quando o usuário ainda é anon
-- e o RLS bloqueia leituras diretas na tabela users).
--
-- Usado por pais/responsáveis e professores que entram com a
-- matrícula em vez do e-mail.

CREATE OR REPLACE FUNCTION public.find_email_by_matricula(p_matricula TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT;
BEGIN
  IF p_matricula IS NULL OR length(trim(p_matricula)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT email INTO result
  FROM public.users
  WHERE (matricula = p_matricula OR username = p_matricula)
    AND active = true
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.find_email_by_matricula(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_email_by_matricula(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_email_by_matricula(TEXT) TO anon;

-- ── VERIFICAÇÃO ─────────────────────────────────────────────
-- Para confirmar que não há mais duplicatas, rode após a migração:
--
--   SELECT matricula, COUNT(*) FROM public.students
--   WHERE matricula IS NOT NULL GROUP BY matricula HAVING COUNT(*) > 1;
--
--   SELECT public.next_matricula();  -- deve retornar o próximo número
