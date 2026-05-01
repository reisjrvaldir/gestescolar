-- =============================================
--  GESTESCOLAR – Calendário do Ano Letivo
--  Feriados municipais/estaduais/imprensados por escola
-- =============================================

CREATE TABLE IF NOT EXISTS public.feriados (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  data        DATE        NOT NULL,
  descricao   TEXT        NOT NULL,
  tipo        TEXT        NOT NULL DEFAULT 'MUNICIPAL'
                          CHECK (tipo IN ('MUNICIPAL','ESTADUAL','IMPRENSADO','RECESSO')),
  criado_por  UUID        REFERENCES public.users(id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, data)
);

CREATE INDEX IF NOT EXISTS idx_feriados_school ON public.feriados(school_id);
CREATE INDEX IF NOT EXISTS idx_feriados_data   ON public.feriados(data);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

-- Todos os usuários da escola podem visualizar
CREATE POLICY "Usuarios da escola veem feriados" ON public.feriados
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND school_id = feriados.school_id)
  );

-- Apenas gestor/admin podem criar/alterar (a API usa service_role, bypassa RLS)
CREATE POLICY "Gestor cria feriados" ON public.feriados
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid()
        AND school_id = feriados.school_id
        AND role IN ('admin','superadmin','gestor','administrativo')
    )
  );

-- ─── REALTIME ─────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.feriados;

-- ─── VERIFICAR ────────────────────────────────────────────────────────────────
SELECT 'feriados' AS tabela_criada;
