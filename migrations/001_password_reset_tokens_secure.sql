-- Migração: Criar tabela password_reset_tokens com segurança aprimorada
-- Data: 2026-04-24
-- Descrição: Tabela para armazenar tokens de recuperação de senha de forma segura

-- Se a tabela antiga existe (com coluna 'token' em plain text), dropar primeiro
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

-- Criar tabela com schema seguro
-- Usa token_hash em vez de armazenar o token em plain text
CREATE TABLE password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,  -- Hash SHA256 do token, nunca armazenar plain text
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Índices para performance e segurança
CREATE INDEX idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- RLS (Row Level Security) - apenas leitura ao admin/API
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service_role (backend API) to manage tokens
CREATE POLICY "service_role_manage_reset_tokens"
  ON password_reset_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true)
  TO service_role;

-- Auto-cleanup: Deletar tokens expirados após 24 horas
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE password_reset_tokens IS 'Armazena tokens de recuperação de senha com expiração de 1 hora. Tokens são armazenados como hash SHA256 para segurança.';
COMMENT ON COLUMN password_reset_tokens.email IS 'Email do usuário solicitando reset de senha';
COMMENT ON COLUMN password_reset_tokens.token_hash IS 'Hash SHA256 do token (NUNCA armazenar token em plain text)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Data/hora de expiração do token (padrão: 1 hora após criação)';
