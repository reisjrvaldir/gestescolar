-- =============================================================================
--  RPC: admin_reset_user_password
--  Alternativa à Edge Function admin-reset-password.
--
--  Permite que um Super Admin redefina a senha de qualquer usuário do Supabase
--  Auth diretamente via PostgreSQL, sem precisar deployar Edge Function nem
--  expor a SERVICE_ROLE_KEY ao frontend.
--
--  Segurança:
--   - SECURITY DEFINER: roda com permissões do owner (postgres), permitindo
--     UPDATE em auth.users.
--   - Valida que auth.jwt() ->> 'email' está em public.super_users.
--   - REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated;
--
--  Uso (frontend):
--     const { data, error } = await supabaseClient.rpc('admin_reset_user_password', {
--       target_email: 'gestor@escola.com',
--       new_password: 'SenhaForte!1'
--     });
--
--  Como aplicar:
--    1. Abra Supabase Dashboard → SQL Editor
--    2. Cole este arquivo inteiro
--    3. Run
-- =============================================================================

-- Garante extensão pgcrypto (para crypt() e gen_salt())
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Drop antigo (idempotente)
DROP FUNCTION IF EXISTS public.admin_reset_user_password(text, text);

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  target_email text,
  new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_email text;
  v_is_super     boolean;
  v_target_id    uuid;
BEGIN
  -- 1. Identifica o chamador via JWT
  v_caller_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_caller_email = '' THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  -- 2. Valida que o chamador é super admin
  SELECT EXISTS (
    SELECT 1 FROM public.super_users WHERE lower(email) = v_caller_email
  ) INTO v_is_super;

  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Apenas super administradores podem redefinir senhas.' USING ERRCODE = '42501';
  END IF;

  -- 3. Validações da senha (mesmas regras do frontend)
  IF new_password IS NULL OR length(new_password) < 8 THEN
    RAISE EXCEPTION 'Senha deve ter no mínimo 8 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF new_password !~ '[A-Z]' THEN
    RAISE EXCEPTION 'Senha deve conter ao menos uma letra maiúscula.' USING ERRCODE = '22023';
  END IF;
  IF new_password !~ '[a-z]' THEN
    RAISE EXCEPTION 'Senha deve conter ao menos uma letra minúscula.' USING ERRCODE = '22023';
  END IF;
  IF new_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'Senha deve conter ao menos um número.' USING ERRCODE = '22023';
  END IF;
  IF new_password !~ '[^A-Za-z0-9]' THEN
    RAISE EXCEPTION 'Senha deve conter ao menos um símbolo.' USING ERRCODE = '22023';
  END IF;

  -- 4. Localiza o user em auth.users
  SELECT id INTO v_target_id
  FROM auth.users
  WHERE lower(email) = lower(target_email)
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', target_email USING ERRCODE = 'P0002';
  END IF;

  -- 5. Atualiza a senha encriptada (bcrypt, igual ao Supabase Auth nativo)
  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    updated_at         = now()
  WHERE id = v_target_id;

  -- 6. Marca needs_password_change para forçar troca no próximo login
  UPDATE public.users
  SET needs_password_change = true
  WHERE auth_id = v_target_id;

  -- 7. Audit log (best-effort; ignora erro se a tabela não tiver schema esperado)
  BEGIN
    INSERT INTO public.audit_log (school_id, action, details)
    VALUES (
      NULL,
      'ADMIN_PASSWORD_RESET_RPC',
      jsonb_build_object(
        'targetEmail',      target_email,
        'targetUserId',     v_target_id,
        'performedByEmail', v_caller_email,
        'at',               now()
      )::text
    );
  EXCEPTION WHEN others THEN
    -- ignorar falha no audit (não bloqueia o reset)
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'userId', v_target_id);
END;
$$;

-- Permissões: só usuários autenticados podem chamar; a própria função valida super admin
REVOKE EXECUTE ON FUNCTION public.admin_reset_user_password(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_reset_user_password(text, text) TO authenticated;

-- Pronto! Teste pelo painel super admin → "Resetar senha do gestor".
