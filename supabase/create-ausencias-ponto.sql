-- =============================================
--  GESTESCOLAR – Ausências / Lançamentos Manuais do Ponto
--  Gestor registra faltas, atestados, abonos em dias sem batida
-- =============================================

CREATE TABLE IF NOT EXISTS public.ausencias_ponto (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id     UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  data          DATE        NOT NULL,

  -- Tipo de ausência
  tipo          TEXT        NOT NULL CHECK (tipo IN (
    'FALTA_JUSTIFICADA',    -- faltou, justificou, desconta horas
    'FALTA_INJUSTIFICADA',  -- faltou sem motivo, desconta
    'ATESTADO_MEDICO',      -- falta SEM desconto de horas
    'DECLARACAO_MEDICA',    -- abona apenas o período do documento
    'ABONADO'               -- dia abonado (não desconta nem soma)
  )),

  -- Período afetado (para DECLARACAO_MEDICA parcial)
  -- 'integral' = dia todo | 'manha' = só manhã | 'tarde' = só tarde
  periodo       TEXT        NOT NULL DEFAULT 'integral'
                            CHECK (periodo IN ('integral','manha','tarde')),

  -- Horas abonadas (calculadas pelo sistema ou informadas pelo gestor)
  -- Ex: declaração médica de 4h → abona 4h, desconta as outras
  horas_abonadas NUMERIC(5,2) DEFAULT 0,

  observacao    TEXT,

  -- Quem registrou
  registrado_por UUID       REFERENCES public.users(id),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Mesmo professor + data = 1 registro
  UNIQUE (user_id, data)
);

CREATE INDEX IF NOT EXISTS idx_ausencias_user   ON public.ausencias_ponto(user_id);
CREATE INDEX IF NOT EXISTS idx_ausencias_data   ON public.ausencias_ponto(data);
CREATE INDEX IF NOT EXISTS idx_ausencias_school ON public.ausencias_ponto(school_id);

-- ─── TRIGGER: atualizado_em automático ───
CREATE OR REPLACE FUNCTION public.touch_ausencia()
RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_ausencia ON public.ausencias_ponto;
CREATE TRIGGER trg_touch_ausencia
  BEFORE UPDATE ON public.ausencias_ponto
  FOR EACH ROW EXECUTE FUNCTION public.touch_ausencia();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.ausencias_ponto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios da escola veem ausencias" ON public.ausencias_ponto;
DROP POLICY IF EXISTS "Gestor administra ausencias"       ON public.ausencias_ponto;

CREATE POLICY "Usuarios da escola veem ausencias" ON public.ausencias_ponto
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND school_id = ausencias_ponto.school_id)
  );

CREATE POLICY "Gestor administra ausencias" ON public.ausencias_ponto
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid()
        AND school_id = ausencias_ponto.school_id
        AND role IN ('admin','superadmin','gestor','administrativo')
    )
  );

-- ─── REALTIME ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ausencias_ponto;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Realtime já ativo para ausencias_ponto';
END $$;

SELECT '✅ Tabela ausencias_ponto criada!' AS resultado;
