-- =============================================
--  GESTESCOLAR – Timeout e Reabertura de Tickets
--  Execute no SQL Editor do Supabase Dashboard
-- =============================================

-- 1. Adicionar colunas de controle
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS aguardando_desde TIMESTAMPTZ;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS fechado_por_timeout BOOLEAN DEFAULT false;

-- 2. Atualizar CHECK constraint para incluir novo status
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('aberto','em_andamento','resolvido','fechado','aguardando_solicitante'));

-- 3. Criar bucket ticket-attachments (se nao existir) — execute separado se der erro
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('ticket-attachments', 'ticket-attachments', true)
-- ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Verificar resultado
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tickets'
  AND column_name IN ('status','aguardando_desde','fechado_por_timeout')
ORDER BY column_name;
