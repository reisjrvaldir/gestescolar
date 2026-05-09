-- =============================================
--  GESTESCOLAR – RPC: check_email_exists
--  Verifica se um e-mail está cadastrado em public.users
--  SECURITY DEFINER → bypassa RLS (usuário ainda é anônimo no login)
--  Executar no SQL Editor do Supabase Dashboard
-- =============================================

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE lower(email) = lower(p_email)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verificar
SELECT public.check_email_exists('teste@exemplo.com') AS resultado;
