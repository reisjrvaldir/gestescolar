-- =============================================
--  GESTESCOLAR – Migração: Campos Asaas Gateway
--  Executar no SQL Editor do Supabase Dashboard
-- =============================================

-- 1. Campos Asaas na tabela schools
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS asaas_account_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT;

-- 2. Garantir que pix_key e commission_rate existem
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 3.00;

-- 3. API Key da subconta (para saques sem precisar acessar Asaas manualmente)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS asaas_sub_api_key TEXT;

-- 4. Campos de endereço (obrigatórios para criar subconta Asaas)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS complement TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- 4. Índice para busca por asaas_id em invoices
CREATE INDEX IF NOT EXISTS idx_invoices_asaas_id ON public.invoices(asaas_id);

-- 5. Verificação
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'schools'
  AND column_name IN ('pix_key', 'commission_rate', 'asaas_account_id', 'asaas_wallet_id',
                       'address_number', 'complement', 'province', 'city', 'state', 'postal_code')
ORDER BY column_name;
