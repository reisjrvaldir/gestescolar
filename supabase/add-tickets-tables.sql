-- =============================================
--  GESTESCOLAR – Sistema de Tickets (Chamados de Suporte)
--  Executar no SQL Editor do Supabase Dashboard
-- =============================================

-- 1. SEQUENCE para numero amigavel (TCK-000001, TCK-000002, ...)
CREATE SEQUENCE IF NOT EXISTS public.tickets_seq START 1;

-- 2. TABELA principal: tickets
CREATE TABLE IF NOT EXISTS public.tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   VARCHAR(20) UNIQUE NOT NULL,
  school_id       UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES public.users(id)   ON DELETE SET NULL,
  user_name       VARCHAR(255),
  categoria       VARCHAR(50)  NOT NULL CHECK (categoria IN ('gestao','financeiro','pedagogico','sistemas')),
  descricao       TEXT NOT NULL,
  imagem_url      TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'aberto'
                  CHECK (status IN ('aberto','em_andamento','resolvido','fechado')),
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_school_id     ON public.tickets(school_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id       ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status        ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_categoria     ON public.tickets(categoria);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON public.tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at    ON public.tickets(created_at DESC);

-- 3. TABELA de comentarios (thread de conversa)
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name   VARCHAR(255),
  user_role   VARCHAR(50),
  mensagem    TEXT NOT NULL,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id  ON public.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user_id    ON public.ticket_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON public.ticket_comments(created_at);

-- 4. RPC para obter o proximo numero formatado (atomico)
CREATE OR REPLACE FUNCTION public.next_ticket_number()
RETURNS TEXT AS $$
DECLARE
  next_num BIGINT;
BEGIN
  next_num := nextval('public.tickets_seq');
  RETURN 'TCK-' || LPAD(next_num::text, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TRIGGER para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.tickets_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_set_updated_at ON public.tickets;
CREATE TRIGGER trg_tickets_set_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_set_updated_at();

-- 6. POLICIES de Row-Level Security (opcional — descomentar se RLS for habilitado)
-- Por enquanto, todas as queries passam pelo cliente Supabase com a chave anon
-- e o controle de acesso e feito no frontend. Em producao, considerar habilitar RLS.
-- ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- 7. VERIFICACAO
SELECT 'tickets' AS tabela, COUNT(*) AS rows FROM public.tickets
UNION ALL
SELECT 'ticket_comments' AS tabela, COUNT(*) AS rows FROM public.ticket_comments;

-- 8. TESTE da RPC (deve retornar TCK-000001 na primeira chamada)
-- SELECT public.next_ticket_number();
