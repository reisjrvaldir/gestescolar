-- =============================================================
--  Campos para integração ASAAS (PIX + cartão + split por subconta).
--  Aditivo e idempotente — não altera a lógica existente.
-- =============================================================

-- Cliente ASAAS do responsável (reaproveitado entre cobranças).
alter table public.guardians
  add column if not exists asaas_customer_id text;

-- Subconta ASAAS da escola (destino do split do valor líquido).
alter table public.schools
  add column if not exists asaas_account_id text,
  add column if not exists asaas_wallet_id  text;

-- Metadados de cobrança na fatura (provedor, tipo e checkout de cartão).
alter table public.invoices
  add column if not exists provider     text default 'asaas',
  add column if not exists billing_type text,           -- pix | credit_card
  add column if not exists checkout_url text;            -- URL de checkout (cartão)

-- payments.provider já existe (default 'nuvende'); atualiza o default para 'asaas'
-- em novos registros. Registros antigos permanecem inalterados.
alter table public.payments
  alter column provider set default 'asaas';
