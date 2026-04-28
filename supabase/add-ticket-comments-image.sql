-- =============================================
--  GESTESCOLAR – Adicionar campo imagem_url a ticket_comments
--  Execute no SQL Editor do Supabase Dashboard
--  Necessário para permitir envio de imagens em comentários de tickets
-- =============================================

-- Adiciona coluna de imagem aos comentários de tickets
ALTER TABLE public.ticket_comments ADD COLUMN imagem_url TEXT;

-- Criar índice para buscar comentários por ticket_id (se ainda não existir)
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);

-- Verificar a estrutura da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ticket_comments'
ORDER BY ordinal_position;
