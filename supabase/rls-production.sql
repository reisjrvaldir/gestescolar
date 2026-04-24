-- =============================================
--  GESTESCOLAR SaaS – RLS PRODUCAO
--  Executar no SQL Editor do Supabase Dashboard
--  Substitui politicas permissivas por politicas reais
-- =============================================

-- =============================================
-- 1. FUNCOES AUXILIARES
-- =============================================
CREATE OR REPLACE FUNCTION get_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna role do usuario logado
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna student_id vinculado ao usuario logado (para role=pai)
CREATE OR REPLACE FUNCTION get_user_student_id()
RETURNS UUID AS $$
  SELECT student_id FROM public.users WHERE auth_id = auth.uid() AND role = 'pai' LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- 2. REMOVER TODAS AS POLITICAS EXISTENTES
-- =============================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END;
$$;

-- =============================================
-- 3. GARANTIR RLS HABILITADO EM TODAS AS TABELAS
-- =============================================
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. POLITICAS PARA SCHOOLS
-- =============================================
-- SELECT: ver apenas sua escola OU superadmin ve todas
CREATE POLICY "schools_select" ON public.schools FOR SELECT USING (
  id = get_user_school_id() OR is_superadmin()
);

-- INSERT: superadmin OU usuario autenticado sem escola ainda (registro inicial)
-- Impede que gestor já cadastrado crie escolas adicionais
CREATE POLICY "schools_insert" ON public.schools FOR INSERT WITH CHECK (
  is_superadmin()
  OR (auth.uid() IS NOT NULL AND get_user_school_id() IS NULL)
);

-- UPDATE: gestor da propria escola OU superadmin
CREATE POLICY "schools_update" ON public.schools FOR UPDATE USING (
  id = get_user_school_id() OR is_superadmin()
);

-- DELETE: apenas superadmin
CREATE POLICY "schools_delete" ON public.schools FOR DELETE USING (
  is_superadmin()
);

-- =============================================
-- 5. POLITICAS PARA USERS
-- =============================================
-- SELECT: mesma escola, proprio usuario, ou superadmin
CREATE POLICY "users_select" ON public.users FOR SELECT USING (
  school_id = get_user_school_id()
  OR auth_id = auth.uid()
  OR is_superadmin()
);

-- INSERT: mesma escola, superadmin, ou registro inicial (sem escola ainda)
-- A condição get_user_school_id() IS NULL cobre apenas quem ainda não tem registro
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (
  is_superadmin()
  OR school_id = get_user_school_id()
  OR (auth.uid() IS NOT NULL AND get_user_school_id() IS NULL)
);

-- UPDATE: mesma escola, proprio usuario, ou superadmin
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (
  school_id = get_user_school_id()
  OR auth_id = auth.uid()
  OR is_superadmin()
);

-- DELETE: mesma escola (gestor) ou superadmin
CREATE POLICY "users_delete" ON public.users FOR DELETE USING (
  school_id = get_user_school_id() OR is_superadmin()
);

-- =============================================
-- 6. POLITICAS PARA CLASSES, EXPENSES, TRANSACTIONS,
--    MESSAGES, AUDIT_LOG (acesso por escola, sem restrição por role)
-- =============================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'classes','expenses','transactions','messages','audit_log'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY "%s_select" ON public.%I FOR SELECT USING (
        school_id = get_user_school_id() OR is_superadmin()
      )', tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON public.%I FOR INSERT WITH CHECK (
        school_id = get_user_school_id() OR is_superadmin()
      )', tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_update" ON public.%I FOR UPDATE USING (
        school_id = get_user_school_id() OR is_superadmin()
      )', tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON public.%I FOR DELETE USING (
        school_id = get_user_school_id() OR is_superadmin()
      )', tbl, tbl
    );
  END LOOP;
END;
$$;

-- =============================================
-- 7. POLITICAS PARA STUDENTS (pai só vê o próprio filho)
-- =============================================
CREATE POLICY "students_select" ON public.students FOR SELECT USING (
  is_superadmin()
  OR (
    school_id = get_user_school_id()
    AND (
      -- Não é pai: gestor/professor/admin vê todos da escola
      get_user_role() != 'pai'
      -- É pai: vê apenas o filho vinculado
      OR id = get_user_student_id()
    )
  )
);

CREATE POLICY "students_insert" ON public.students FOR INSERT WITH CHECK (
  school_id = get_user_school_id() OR is_superadmin()
);

CREATE POLICY "students_update" ON public.students FOR UPDATE USING (
  school_id = get_user_school_id() OR is_superadmin()
);

CREATE POLICY "students_delete" ON public.students FOR DELETE USING (
  school_id = get_user_school_id() OR is_superadmin()
);

-- =============================================
-- 8. POLITICAS PARA INVOICES (pai só vê faturas do próprio filho)
-- =============================================
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING (
  is_superadmin()
  OR (
    school_id = get_user_school_id()
    AND (
      get_user_role() != 'pai'
      OR student_id = get_user_student_id()
    )
  )
);

CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT WITH CHECK (
  school_id = get_user_school_id() OR is_superadmin()
);

CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE USING (
  school_id = get_user_school_id() OR is_superadmin()
);

CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE USING (
  school_id = get_user_school_id() OR is_superadmin()
);

-- =============================================
-- 9. POLITICAS PARA GRADES (pai só vê notas do próprio filho)
-- =============================================
CREATE POLICY "grades_select" ON public.grades FOR SELECT USING (
  is_superadmin()
  OR (
    school_id = get_user_school_id()
    AND (
      get_user_role() != 'pai'
      OR student_id = get_user_student_id()
    )
  )
);

CREATE POLICY "grades_insert" ON public.grades FOR INSERT WITH CHECK (
  school_id = get_user_school_id() OR is_superadmin()
);

CREATE POLICY "grades_update" ON public.grades FOR UPDATE USING (
  school_id = get_user_school_id() OR is_superadmin()
);

CREATE POLICY "grades_delete" ON public.grades FOR DELETE USING (
  school_id = get_user_school_id() OR is_superadmin()
);

-- =============================================
-- 10. POLITICAS PARA ATTENDANCE (pai só vê frequência do próprio filho)
-- =============================================
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT USING (
  is_superadmin()
  OR (
    school_id = get_user_school_id()
    AND (
      get_user_role() != 'pai'
      OR student_id = get_user_student_id()
    )
  )
);

CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT WITH CHECK (
  school_id = get_user_school_id() OR is_superadmin()
);

CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE USING (
  school_id = get_user_school_id() OR is_superadmin()
);

CREATE POLICY "attendance_delete" ON public.attendance FOR DELETE USING (
  school_id = get_user_school_id() OR is_superadmin()
);

-- =============================================
-- 11. INDICES PARA PERFORMANCE DO RLS
-- =============================================
CREATE INDEX IF NOT EXISTS idx_users_auth_id    ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_school_id  ON public.users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_role       ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON public.users(student_id);

-- =============================================
-- 12. VERIFICACAO FINAL
-- =============================================
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
