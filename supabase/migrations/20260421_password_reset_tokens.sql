-- Create password_reset_tokens table for storing temporary reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_email CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email_token
  ON password_reset_tokens(email, token);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON password_reset_tokens(expires_at);

-- Enable RLS with restrictive policies
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- DENY all SELECT - token validation must happen server-side only via service role
CREATE POLICY "Disable public token lookup" ON password_reset_tokens
  FOR SELECT
  USING (false);

-- Allow INSERT via service role only (no public insert)
CREATE POLICY "Disable public token creation" ON password_reset_tokens
  FOR INSERT
  WITH CHECK (false);

-- Allow DELETE via service role only (no public delete)
CREATE POLICY "Disable public token deletion" ON password_reset_tokens
  FOR DELETE
  USING (false);
