-- =============================================================
--  0034 — Resposta do responsável a cobranças avulsas.
--
--  guardian_response:
--    - 'declined' → responsável clicou em "Não participar". A fatura vai
--      para status='cancelled' automaticamente; o aluno não recebe cobrança.
--    - 'disputed' → responsável clicou em "Contestar" pedindo mais informações.
--      A fatura permanece pendente até a escola resolver, mas o gestor vê que
--      há uma contestação em aberto no financeiro/faturas.
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

alter table public.invoices
  add column if not exists guardian_response      text
    check (guardian_response in ('declined','disputed')),
  add column if not exists guardian_response_note text,
  add column if not exists guardian_response_at   timestamptz;
