-- =============================================
--  GESTESCOLAR – Sistema de Tickets (Read Tracking)
--  Adiciona campo para rastrear quais usuarios leram cada ticket
--  Executar no SQL Editor do Supabase Dashboard
-- =============================================

-- Adiciona coluna read_by (array JSON de user_ids que leram o ticket)
ALTER TABLE IF EXISTS public.tickets
ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]'::jsonb;

-- Index para melhorar queries sobre leitura
CREATE INDEX IF NOT EXISTS idx_tickets_read_by ON public.tickets USING GIN(read_by);

-- Trigger para resetar read_by quando status muda (novo comentario = volta a ficar "nao lido")
-- Na verdade, nao vamos resetar. Vamos rastrear por comentario individual em vez disso.
-- Cada comentario tem um "is_read" field que rastreia quem leu aquele comentario especifico.

-- Adiciona campo has_unread_comments ao tickets (denormalizacao para query rápida)
ALTER TABLE IF EXISTS public.tickets
ADD COLUMN IF NOT EXISTS has_unread_comments BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tickets_has_unread ON public.tickets(has_unread_comments);

-- Verifica estrutura
SELECT 'Migração concluída: read_by e has_unread_comments adicionadas ao tickets' AS status;
