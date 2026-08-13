-- =============================================================
--  0033 — Campos de endereço do aluno.
--
--  Substitui gradualmente `naturality` por um endereço completo,
--  puxado automaticamente pelo CEP via ViaCEP. `naturality` fica
--  na tabela por retrocompatibilidade (não removemos dados existentes).
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

alter table public.students
  add column if not exists address_zip          text,
  add column if not exists address_street       text,
  add column if not exists address_number       text,
  add column if not exists address_complement   text,
  add column if not exists address_neighborhood text,
  add column if not exists address_city         text,
  add column if not exists address_state        text;
