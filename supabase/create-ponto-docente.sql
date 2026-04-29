-- =============================================
--  GESTESCOLAR – Controle de Ponto Docente
--  Execute no SQL Editor do Supabase Dashboard
-- =============================================

-- ─── TABELA: pontos_docente ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pontos_docente (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo          TEXT        NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA','INTERVALO_INICIO','INTERVALO_FIM')),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  descricao     TEXT,
  device_id     TEXT,
  status        TEXT        NOT NULL DEFAULT 'PENDENTE'
                            CHECK (status IN ('AUTO_VALIDADO','PENDENTE','APROVADO','REJEITADO')),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pontos_user_id   ON public.pontos_docente(user_id);
CREATE INDEX IF NOT EXISTS idx_pontos_timestamp  ON public.pontos_docente(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pontos_status     ON public.pontos_docente(status);

-- ─── TABELA: ajustes_ponto ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ajustes_ponto (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ponto_id           UUID        NOT NULL REFERENCES public.pontos_docente(id) ON DELETE CASCADE,
  justificativa      TEXT        NOT NULL,
  timestamp_ajustado TIMESTAMPTZ NOT NULL,
  aprovado_por       UUID        REFERENCES public.users(id),
  status             TEXT        NOT NULL DEFAULT 'PENDENTE'
                                 CHECK (status IN ('PENDENTE','APROVADO','REJEITADO')),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ajustes_ponto_id ON public.ajustes_ponto(ponto_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_status   ON public.ajustes_ponto(status);

-- ─── TABELA: auditoria_ponto ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auditoria_ponto (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ponto_id             UUID        NOT NULL REFERENCES public.pontos_docente(id) ON DELETE CASCADE,
  acao                 TEXT        NOT NULL,
  usuario_responsavel  UUID        REFERENCES public.users(id),
  dados_anteriores     JSONB,
  dados_novos          JSONB,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_ponto_id ON public.auditoria_ponto(ponto_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON public.auditoria_ponto(criado_em DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.pontos_docente  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_ponto   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_ponto ENABLE ROW LEVEL SECURITY;

-- A API usa service_role key → bypassa RLS. Políticas para acesso direto do cliente:
CREATE POLICY "Professor vê próprios pontos" ON public.pontos_docente
  FOR SELECT USING (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "Gestor vê todos os pontos" ON public.pontos_docente
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_id = auth.uid()
        AND role IN ('admin','superadmin')
    )
  );

-- ─── REALTIME ─────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.pontos_docente;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ajustes_ponto;

-- ─── VERIFICAR ────────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('pontos_docente','ajustes_ponto','auditoria_ponto')
ORDER BY table_name;
