-- =============================================
--  GESTESCOLAR – Habilitar Realtime para Tickets
--  Execute no SQL Editor do Supabase Dashboard
--  Necessário para notificações em tempo real
-- =============================================

-- Habilita as tabelas de tickets na publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments;

-- Verificar tabelas habilitadas:
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
