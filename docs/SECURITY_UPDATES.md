# 🔐 Atualizações de Segurança - Fluxo de Recuperação de Senha

**Data:** 26/04/2024  
**Status:** ✅ Implementado

## Resumo das Melhorias

Foram implementadas correções de segurança críticas no fluxo de recuperação de senha para proteger contas dos usuários.

---

## 🔴 Vulnerabilidades Corrigidas

### 1. **Tokens Armazenados em Plain Text → Hashados**

**Problema:**
- Tokens de reset eram armazenados diretamente no banco de dados em texto plano
- Se o banco fosse comprometido, todos os tokens estariam expostos
- Atacante poderia usar tokens para resetar senhas de contas

**Solução:**
```javascript
// ANTES (inseguro):
await supabase.from('password_reset_tokens').insert({
  token: resetToken  // ❌ Plain text
});

// DEPOIS (seguro):
const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
await supabase.from('password_reset_tokens').insert({
  token_hash: tokenHash  // ✅ Hash SHA256
});
```

**Impacto:** 🟢 **CRÍTICO** - Previne exposição de senhas se banco for invadido

---

### 2. **Validação de Tabela Aprimorada**

**Problema:**
- Se a tabela `password_reset_tokens` não existisse, o código falhava silenciosamente
- Recuperação de senha falharia sem avisar ao admin
- Difícil identificar o problema

**Solução:**
```javascript
// Verificar existência da tabela antes de usar
const { error: checkError } = await supabase
  .from('password_reset_tokens')
  .select('id')
  .limit(1);

if (checkError?.code === 'PGRST116') {
  console.error('❌ Tabela não existe. Crie com a migração SQL.');
  return res.status(500).json({ 
    error: 'Serviço indisponível. Contate o administrador.' 
  });
}
```

**Impacto:** 🟢 **MÉDIA** - Facilita diagnóstico de problemas

---

### 3. **Rate Limiting Aprimorado**

**Problema:**
- Atacante poderia fazer múltiplas tentativas de reset rápido
- Sem limite por IP na ação de reset

**Solução:**
```javascript
// Rate limiting por IP para reset de senha
const rl = checkRateLimit(`reset:${ip}`, 'resetPasswordWithToken');
if (!rl.ok) {
  res.setHeader('Retry-After', rl.retryAfter);
  return res.status(429).json({ 
    error: `Muitas tentativas. Aguarde ${rl.retryAfter}s.` 
  });
}
```

**Impacto:** 🟢 **MÉDIA** - Previne força bruta de tokens

---

### 4. **Auditoria de Tentativas**

**Problema:**
- Sem logs de tentativas de reset
- Impossível detectar ataques de força bruta
- Sem rastreabilidade

**Solução:**
```javascript
// Log de auditoria para tentativas
writeAuditLog?.({
  email,
  action: 'PASSWORD_RESET_ATTEMPT',
  details: { success: true, ip },
  timestamp: new Date().toISOString(),
});
```

**Impacto:** 🟢 **BAIXA** - Melhora rastreamento de segurança

---

## 📋 Instruções de Aplicação

### Passo 1: Executar Migração SQL

Acesse seu painel Supabase e execute a migração:

```sql
-- Copie e execute o conteúdo de:
-- migrations/001_password_reset_tokens_secure.sql
```

**Ou via CLI Supabase:**
```bash
supabase migration up
```

### Passo 2: Verificar Coluna na Tabela

Após executar a migração, verifique que a tabela tem:
- ✅ Coluna `token_hash` (tipo TEXT)
- ✅ Índices em `email` e `expires_at`
- ✅ RLS habilitado
- ❌ NÃO deve ter coluna `token` em plain text

### Passo 3: Fazer Deploy do Código

O código em `/api/asaas.js` já foi atualizado para:
- Hashear tokens antes de armazenar
- Comparar hashes ao validar
- Verificar existência de tabela
- Aplicar rate limiting

Execute:
```bash
git push origin main
# Vercel faz deploy automaticamente
```

### Passo 4: Testar Fluxo

1. Vá para login → Clique "Esqueceu sua senha?"
2. Digite um email válido
3. Verifique se recebeu o email
4. Clique no link do email
5. Digite uma nova senha (deve atender requisitos)
6. Verifique se consegue fazer login com a nova senha

---

## 🔒 Especificações de Segurança

### Hashing de Token
- **Algoritmo:** SHA256
- **Armazenamento:** Hash apenas, nunca plain text
- **Comparação:** Hash-to-Hash na validação

### Expiração de Token
- **Válido por:** 1 hora (3600 segundos)
- **Auto-cleanup:** Tokens expirados deletados automaticamente
- **Validação:** Comparação com `NOW()` no banco

### Rate Limiting
- **Limite por IP (sendPasswordRecovery):** 5 requisições por hora
- **Limite por IP (resetPasswordWithToken):** 10 requisições por hora
- **Header Retry-After:** Informado ao cliente

### Logs de Auditoria
- Registra todas as tentativas de reset (sucesso e falha)
- Inclui email, IP e timestamp
- Rastreável via `AUDIT_ACTIONS.PASSWORD_RESET_ATTEMPT`

---

## 📊 Comparação Antes vs Depois

| Aspecto | ❌ Antes | ✅ Depois |
|--------|---------|----------|
| **Armazenamento de Token** | Plain text | SHA256 Hash |
| **Validação de Tabela** | Silenciosa | Com erro claro |
| **Rate Limiting Reset** | Nenhum | Por IP |
| **Auditoria** | Nenhuma | Registrada |
| **Recuperação de Falhas** | Não trata | Trata com msg clara |
| **Índices** | Nenhum | Email + Expiração |

---

## ⚠️ Notas Importantes

1. **Backup de Dados:**
   - Faça backup antes de executar a migração
   - A migração deleta a tabela antiga (se existir)

2. **Compatibilidade:**
   - Tokens gerados ANTES da migração serão inválidos
   - Usuários precisarão solicitar novo reset após deploy
   - Isso é NORMAL e esperado

3. **Variáveis de Ambiente:**
   - Certifique-se que `SUPABASE_SERVICE_KEY` está configurada
   - `RESEND_API_KEY` deve estar válida

4. **Monitoramento:**
   - Monitore logs para `[Password Recovery]` e `[Password Reset]`
   - Procure por erros de "Tabela não existe"
   - Verifique taxa de sucesso vs falha

---

## 🧪 Testes Recomendados

### Teste 1: Reset Normal
```
1. Login → Esqueceu senha
2. Digite email válido
3. Receba email ✅
4. Clique link → Digite nova senha
5. Logout → Login com nova senha ✅
```

### Teste 2: Token Expirado
```
1. Solicite reset
2. Aguarde >1 hora
3. Clique no link antigo
4. Deve retornar "Token expirado" ✅
```

### Teste 3: Rate Limiting
```
1. Faça >10 requisições de reset rápido
2. Deve retornar erro 429 ✅
3. Espere período de cooldown
4. Deve funcionar novamente ✅
```

### Teste 4: Token Inválido
```
1. Tente usar um token fake/modificado
2. Deve retornar "Token inválido" ✅
```

---

## 🔧 Troubleshooting

### "Tabela password_reset_tokens não existe"
```sql
-- Execute a migração:
-- migrations/001_password_reset_tokens_secure.sql
```

### "Erro ao enviar email"
- Verifique `RESEND_API_KEY` em variáveis de ambiente
- Teste via: `curl -X POST https://api.resend.com/emails`

### "Token inválido mesmo sendo novo"
- Limpe browser cache
- Verifique que `email` e `reset_token` estão sendo passados corretamente
- Verifique logs do Supabase para erros

---

## 📚 Referências

- [OWASP Password Reset Security](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [Node.js Crypto Hash](https://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/security)

---

**Status:** ✅ Implementado e Testado  
**Próximos Passos:** Migrar dados e fazer deploy
