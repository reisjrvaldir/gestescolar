-- =============================================
--  GESTESCOLAR – RESET DE DADOS PARA TESTES
--  ⚠️  Apaga TODOS os dados exceto a conta superadmin
--  ✅  NÃO altera estrutura (tabelas, índices, RLS, sequences de schema)
--  ✅  Mantém platform_settings (configurações de email da plataforma)
--  Executar no SQL Editor do Supabase Dashboard
-- =============================================

BEGIN;

-- ─── PRÉ-VERIFICAÇÃO: confirmar superadmin ────────────────────────────────────
DO $$
DECLARE
  v_auth_id UUID;
  v_email   TEXT;
  v_count   INT;
BEGIN
  SELECT auth_id, email INTO v_auth_id, v_email
    FROM public.users
   WHERE role = 'superadmin'
   LIMIT 1;

  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION '❌ Nenhum superadmin encontrado! Abortando reset.';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.users WHERE role = 'superadmin';
  RAISE NOTICE '🔒 Preservando % superadmin(s). Conta principal: % (auth_id: %)',
               v_count, v_email, v_auth_id;
END $$;

-- ─── 1. Ponto docente (dependem de users, sem school_id direto) ───────────────
DELETE FROM public.auditoria_ponto;
DELETE FROM public.ajustes_ponto;
DELETE FROM public.pontos_docente;

-- ─── 2. Ausências e jornadas ──────────────────────────────────────────────────
DELETE FROM public.ausencias_ponto;
DELETE FROM public.professor_jornadas;

-- ─── 3. Tickets e comentários ─────────────────────────────────────────────────
DELETE FROM public.ticket_comments;
DELETE FROM public.tickets;

-- ─── 4. Pedagógico ────────────────────────────────────────────────────────────
DELETE FROM public.grades;
DELETE FROM public.attendance;

-- ─── 5. Financeiro ────────────────────────────────────────────────────────────
DELETE FROM public.invoices;
DELETE FROM public.expenses;
DELETE FROM public.transactions;

-- ─── 6. Comunicação e calendário ──────────────────────────────────────────────
DELETE FROM public.messages;
DELETE FROM public.feriados;

-- ─── 7. Log de auditoria ──────────────────────────────────────────────────────
DELETE FROM public.audit_log;

-- ─── 8. Tokens de recuperação de senha ────────────────────────────────────────
DELETE FROM public.password_reset_tokens;

-- ─── 9. Alunos e turmas ───────────────────────────────────────────────────────
DELETE FROM public.students;
DELETE FROM public.classes;

-- ─── 10. Deletar usuários não-superadmin do Auth (cascata limpa public.users) ─
--  ON DELETE CASCADE em public.users(auth_id) garante limpeza automática
DELETE FROM auth.users
 WHERE id NOT IN (
   SELECT auth_id
     FROM public.users
    WHERE role = 'superadmin'
      AND auth_id IS NOT NULL
 );

-- ─── 11. Deletar escolas ──────────────────────────────────────────────────────
--  Limpa qualquer registro órfão remanescente via CASCADE
DELETE FROM public.schools;

-- ─── 12. Resetar sequence dos tickets ─────────────────────────────────────────
ALTER SEQUENCE IF EXISTS public.tickets_seq RESTART WITH 1;

-- ─── VERIFICAÇÃO FINAL ────────────────────────────────────────────────────────
SELECT tabela, registros FROM (
  SELECT 'auth.users'          AS tabela, COUNT(*)::INT AS registros, 1 AS ord FROM auth.users
  UNION ALL
  SELECT 'public.users',        COUNT(*)::INT, 2  FROM public.users
  UNION ALL
  SELECT 'schools',             COUNT(*)::INT, 3  FROM public.schools
  UNION ALL
  SELECT 'classes',             COUNT(*)::INT, 4  FROM public.classes
  UNION ALL
  SELECT 'students',            COUNT(*)::INT, 5  FROM public.students
  UNION ALL
  SELECT 'invoices',            COUNT(*)::INT, 6  FROM public.invoices
  UNION ALL
  SELECT 'expenses',            COUNT(*)::INT, 7  FROM public.expenses
  UNION ALL
  SELECT 'transactions',        COUNT(*)::INT, 8  FROM public.transactions
  UNION ALL
  SELECT 'grades',              COUNT(*)::INT, 9  FROM public.grades
  UNION ALL
  SELECT 'attendance',          COUNT(*)::INT, 10 FROM public.attendance
  UNION ALL
  SELECT 'messages',            COUNT(*)::INT, 11 FROM public.messages
  UNION ALL
  SELECT 'audit_log',           COUNT(*)::INT, 12 FROM public.audit_log
  UNION ALL
  SELECT 'feriados',            COUNT(*)::INT, 13 FROM public.feriados
  UNION ALL
  SELECT 'pontos_docente',      COUNT(*)::INT, 14 FROM public.pontos_docente
  UNION ALL
  SELECT 'ajustes_ponto',       COUNT(*)::INT, 15 FROM public.ajustes_ponto
  UNION ALL
  SELECT 'auditoria_ponto',     COUNT(*)::INT, 16 FROM public.auditoria_ponto
  UNION ALL
  SELECT 'professor_jornadas',  COUNT(*)::INT, 17 FROM public.professor_jornadas
  UNION ALL
  SELECT 'ausencias_ponto',     COUNT(*)::INT, 18 FROM public.ausencias_ponto
  UNION ALL
  SELECT 'tickets',             COUNT(*)::INT, 19 FROM public.tickets
  UNION ALL
  SELECT 'ticket_comments',     COUNT(*)::INT, 20 FROM public.ticket_comments
  UNION ALL
  SELECT 'password_reset_tokens', COUNT(*)::INT, 21 FROM public.password_reset_tokens
  UNION ALL
  SELECT 'platform_settings (preservado)', COUNT(*)::INT, 22 FROM public.platform_settings
) t
ORDER BY ord;

COMMIT;

-- ─── RESULTADO ESPERADO ────────────────────────────────────────────────────────
-- auth.users              → 1  (apenas superadmin)
-- public.users            → 1  (apenas superadmin)
-- Todas as demais tabelas → 0
-- platform_settings       → N  (configurações de email preservadas ✅)
