-- =============================================
--  ADICIONAR CAMPOS DE TESTE (TRIAL) À TABELA SCHOOLS
-- =============================================

-- Adicionar coluna school_status para rastrear estado da escola (trial, active, inactive)
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS school_status TEXT DEFAULT 'trial' CHECK (school_status IN ('trial', 'active', 'inactive'));

-- Adicionar coluna trial_started_at para rastrear quando o período de teste começou
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Criar índice para melhorar performance ao filtrar escolas em teste
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(school_status);

-- Atualizar escolas existentes para status 'active' (já têm plano, não estão em teste)
UPDATE schools SET school_status = 'active' WHERE school_status IS NULL OR school_status = 'trial';

-- Comentários explicativos
COMMENT ON COLUMN schools.school_status IS 'Status da escola: trial (7 dias gratuito), active (pagamento realizado), inactive (cancelada)';
COMMENT ON COLUMN schools.trial_started_at IS 'Data/hora do início do período de teste de 7 dias';
