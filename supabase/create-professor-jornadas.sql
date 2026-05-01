-- =============================================
--  GESTESCOLAR – Jornada de Trabalho do Professor
--  Define dias, períodos, carga horária e intervalo
-- =============================================

CREATE TABLE IF NOT EXISTS public.professor_jornadas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,

  -- ─── Dias da semana que o professor trabalha ───
  trabalha_seg BOOLEAN NOT NULL DEFAULT TRUE,
  trabalha_ter BOOLEAN NOT NULL DEFAULT TRUE,
  trabalha_qua BOOLEAN NOT NULL DEFAULT TRUE,
  trabalha_qui BOOLEAN NOT NULL DEFAULT TRUE,
  trabalha_sex BOOLEAN NOT NULL DEFAULT TRUE,
  trabalha_sab BOOLEAN NOT NULL DEFAULT FALSE,
  trabalha_dom BOOLEAN NOT NULL DEFAULT FALSE,

  -- ─── Período 1 (sempre obrigatório) ───
  -- Pode ser manhã (07:30-12:30) ou tarde (13:00-17:30) ou integral
  periodo1_entrada TIME NOT NULL,
  periodo1_saida   TIME NOT NULL,

  -- ─── Período 2 (opcional, para jornada integral) ───
  -- Quando preenchido = professor trabalha 2 turnos no mesmo dia
  periodo2_entrada TIME,
  periodo2_saida   TIME,

  -- ─── Intervalo descontado (minutos) ───
  -- Usado quando prof bate só ENTRADA/SAIDA (sem batida de intervalo)
  -- Ex: bateu 08:00 e 18:00 (10h), intervalo=60 → computa 9h
  intervalo_minutos INT NOT NULL DEFAULT 0 CHECK (intervalo_minutos >= 0),

  -- ─── Carga horária semanal (definida pelo gestor) ───
  -- Ex: 44.00, 40.00, 20.00
  carga_horaria_semanal NUMERIC(5,2) NOT NULL CHECK (carga_horaria_semanal > 0),

  -- ─── Tolerância para validação de período (minutos) ───
  -- Margem antes/depois do horário cadastrado para aceitar batida automaticamente
  tolerancia_minutos INT NOT NULL DEFAULT 15 CHECK (tolerancia_minutos >= 0),

  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Validações
  CHECK (periodo1_saida > periodo1_entrada),
  CHECK (
    (periodo2_entrada IS NULL AND periodo2_saida IS NULL) OR
    (periodo2_entrada IS NOT NULL AND periodo2_saida IS NOT NULL AND periodo2_saida > periodo2_entrada)
  ),
  CHECK (
    periodo2_entrada IS NULL OR periodo2_entrada >= periodo1_saida
  )
);

-- ─── ÍNDICES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jornadas_user   ON public.professor_jornadas(user_id);
CREATE INDEX IF NOT EXISTS idx_jornadas_school ON public.professor_jornadas(school_id);

-- ─── TRIGGER: atualizar atualizado_em automaticamente ────────────────────────
CREATE OR REPLACE FUNCTION public.touch_jornada()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_jornada ON public.professor_jornadas;
CREATE TRIGGER trg_touch_jornada
  BEFORE UPDATE ON public.professor_jornadas
  FOR EACH ROW EXECUTE FUNCTION public.touch_jornada();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.professor_jornadas ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas (caso já existam)
DROP POLICY IF EXISTS "Usuarios da escola veem jornadas" ON public.professor_jornadas;
DROP POLICY IF EXISTS "Gestor administra jornadas"      ON public.professor_jornadas;

-- Todos os usuários da escola podem visualizar (professor vê a própria, gestor vê todas)
CREATE POLICY "Usuarios da escola veem jornadas" ON public.professor_jornadas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid()
        AND school_id = professor_jornadas.school_id
    )
  );

-- Apenas gestor/admin podem criar/editar/deletar
CREATE POLICY "Gestor administra jornadas" ON public.professor_jornadas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid()
        AND school_id = professor_jornadas.school_id
        AND role IN ('admin','superadmin','gestor','administrativo')
    )
  );

-- ─── REALTIME ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.professor_jornadas;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Realtime já estava ativo para professor_jornadas';
END $$;

-- ─── ADICIONAR CAMPO NA TABELA pontos_docente ────────────────────────────────
-- Status novo: 'pendente_fora_periodo' quando batida fora do período cadastrado
DO $$
BEGIN
  -- Verifica se o status já tem o novo valor
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%pontos_docente_status%'
      AND check_clause LIKE '%pendente_fora_periodo%'
  ) THEN
    -- Remove constraint antiga
    EXECUTE (
      SELECT 'ALTER TABLE public.pontos_docente DROP CONSTRAINT ' || constraint_name
      FROM information_schema.check_constraints
      WHERE constraint_name LIKE '%pontos_docente_status%'
      LIMIT 1
    );
    -- Adiciona nova
    ALTER TABLE public.pontos_docente
      ADD CONSTRAINT pontos_docente_status_check
      CHECK (status IN (
        'pendente_validacao','auto_validado','aprovado','rejeitado','pendente_fora_periodo'
      ));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Não foi possível atualizar constraint de status (pode já estar atualizada): %', SQLERRM;
END $$;

-- ─── VERIFICAR ────────────────────────────────────────────────────────────────
SELECT '✅ Tabela professor_jornadas criada com sucesso!' AS resultado;
