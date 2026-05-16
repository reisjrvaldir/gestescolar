-- =============================================
--  GESTESCOLAR – Lock de Avaliações (Server-side)
--  Substitui o localStorage pelo banco de dados.
--  Executar no SQL Editor do Supabase Dashboard.
-- =============================================

CREATE TABLE IF NOT EXISTS public.grade_locks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id      UUID        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  unit          TEXT        NOT NULL,
  subject       TEXT        NOT NULL,
  locked_by     UUID        REFERENCES public.users(id),
  locked_by_name TEXT,
  locked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, class_id, unit, subject)
);

CREATE INDEX IF NOT EXISTS idx_grade_locks_class ON public.grade_locks(class_id);
CREATE INDEX IF NOT EXISTS idx_grade_locks_school ON public.grade_locks(school_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.grade_locks ENABLE ROW LEVEL SECURITY;

-- Todos os usuários da escola podem ver quais avaliações estão bloqueadas
CREATE POLICY "grade_locks_select" ON public.grade_locks
  FOR SELECT USING (school_id = get_user_school_id());

-- Professores e gestores da escola podem criar locks
CREATE POLICY "grade_locks_insert" ON public.grade_locks
  FOR INSERT WITH CHECK (school_id = get_user_school_id());

-- Apenas gestor/administrativo pode remover locks (desbloquear)
CREATE POLICY "grade_locks_delete" ON public.grade_locks
  FOR DELETE USING (
    school_id = get_user_school_id()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid()
        AND role IN ('gestor', 'administrativo', 'superadmin')
    )
  );

-- ─── VERIFICAR ────────────────────────────────────────────────────────────────
SELECT 'grade_locks' AS tabela_criada, COUNT(*) AS registros FROM public.grade_locks;
