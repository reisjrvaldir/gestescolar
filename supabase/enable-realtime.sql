-- =============================================
--  GESTESCOLAR – Habilitar Supabase Realtime
--  Execute uma vez no SQL Editor do Supabase
-- =============================================

-- Adiciona invoices e messages à publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Verificar tabelas habilitadas (opcional):
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
