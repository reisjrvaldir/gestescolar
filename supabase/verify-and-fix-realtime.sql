-- =============================================
--  GESTESCOLAR – Verificar e Corrigir Realtime
--  Execute no SQL Editor do Supabase Dashboard
-- =============================================

-- 1. Verificar quais tabelas estão habilitadas para Realtime
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 2. Se as tabelas NÃO aparecerem no resultado acima, execute isto:
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments;

-- 3. Verificar RLS - se estiver ativado, pode estar bloqueando eventos
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('tickets', 'ticket_comments');

-- 4. Verificar políticas RLS existentes
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('tickets', 'ticket_comments')
ORDER BY tablename, policyname;
