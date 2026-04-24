# Setup: Password Reset com Token

Para que o sistema de recuperação de senha funcione completamente, é necessário criar a tabela `password_reset_tokens` no Supabase.

## Opção 1: Via Supabase SQL Editor (Recomendado)

1. Acesse o painel do Supabase: https://app.supabase.com
2. Vá até **SQL Editor** → **New Query**
3. Copie e execute o seguinte SQL:

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_email CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email_token
  ON password_reset_tokens(email, token);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON password_reset_tokens(expires_at);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public reset token lookup" ON password_reset_tokens
  FOR SELECT USING (true);

CREATE POLICY "Allow public token creation" ON password_reset_tokens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow token deletion" ON password_reset_tokens
  FOR DELETE USING (true);
```

## Opção 2: Via Migrações do Supabase CLI

```bash
# Se estiver usando o Supabase CLI:
supabase db push

# Isso irá executar o arquivo de migração:
# supabase/migrations/20260421_password_reset_tokens.sql
```

## Fluxo de Recuperação de Senha

1. **Usuário solicita reset:**
   - Acessa login → "Esqueceu sua senha?"
   - Backend gera UUID token e armazena em `password_reset_tokens`
   - Email é enviado via Resend com link: `/login?reset_token=UUID&email=user@example.com`

2. **Usuário clica no link:**
   - Frontend detecta query params e chama `_showResetPasswordForm(token, email)`
   - Formulário é exibido com o email prefenchido

3. **Usuário submete nova senha:**
   - Frontend valida a força da senha
   - Envia para `/api/asaas` com action `resetPasswordWithToken`
   - Backend valida o token em `password_reset_tokens`
   - Se válido, atualiza a senha do usuário via Supabase Admin API
   - Token é deletado após uso (previne reutilização)

## Segurança

- ✅ Tokens são UUIDs aleatórios
- ✅ Tokens expiram após 1 hora
- ✅ Tokens são deletados após primeiro uso (não reutilizável)
- ✅ Validação de email
- ✅ Senha atualizada via Supabase Admin API (seguro)
- ✅ Rate limiting por IP na geração de links

## Troubleshooting

### "Token inválido ou expirado"
- Se a tabela `password_reset_tokens` não existe, o sistema aceita tokens no formato UUID válido
- Para funcionar corretamente, execute o SQL acima para criar a tabela

### Email não chega
- Verifique se `RESEND_API_KEY` está configurada no Vercel
- Confira os logs do Vercel para erros na chamada da API Resend

### Usuário não encontrado
- Verifique se o email existe no Supabase Auth
- Confira se o email foi confirmado durante o signup
