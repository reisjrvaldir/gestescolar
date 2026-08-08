-- Adicionar flag is_pilot às escolas para identificar contas piloto/teste.
-- Padrão: false (produção). Usado para analytics, quotas especiais, etc.

ALTER TABLE schools ADD COLUMN is_pilot BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_schools_is_pilot ON schools(is_pilot) WHERE is_pilot = true;
