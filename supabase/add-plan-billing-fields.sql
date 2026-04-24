-- =============================================
--  CAMPOS DE COBRAN\u00c7A E RENOVA\u00c7\u00c3O DE PLANO
--  Necess\u00e1rios para o fluxo PIX mensal com renova\u00e7\u00e3o a cada 30 dias,
--  PIX anual com expira\u00e7\u00e3o em 12 meses, e cart\u00e3o com assinatura Asaas.
-- =============================================

-- Data de expira\u00e7\u00e3o do plano (null = assinatura recorrente, sem expira\u00e7\u00e3o local)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;

-- Tipo de cobran\u00e7a: 'mensal' ou 'anual'
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS billing TEXT CHECK (billing IN ('mensal', 'anual'));

-- Data do upgrade (ativa\u00e7\u00e3o do plano)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS upgraded_at TIMESTAMP WITH TIME ZONE;

-- ID do pagamento Asaas (\u00faltimo pagamento registrado)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS plan_payment_id TEXT;

-- ID da assinatura Asaas (apenas cart\u00e3o recorrente)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS plan_subscription_id TEXT;

-- \u00cdndice para consultas de renova\u00e7\u00e3o (achar escolas expirando em breve)
CREATE INDEX IF NOT EXISTS idx_schools_plan_expires_at
  ON schools(plan_expires_at)
  WHERE plan_expires_at IS NOT NULL;

-- Coment\u00e1rios
COMMENT ON COLUMN schools.plan_expires_at IS 'Data de expira\u00e7\u00e3o do plano. Null = assinatura recorrente (cart\u00e3o). PIX mensal = created+30d. PIX anual = created+365d.';
COMMENT ON COLUMN schools.billing IS 'mensal ou anual';
COMMENT ON COLUMN schools.plan_payment_id IS '\u00daltimo paymentId do Asaas (PIX)';
COMMENT ON COLUMN schools.plan_subscription_id IS 'subscriptionId do Asaas (apenas cart\u00e3o mensal recorrente)';
