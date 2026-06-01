# ⚙️ PRÓXIMOS PASSOS — Limpeza Manual (Supabase + Vercel)

**Status:** Código deletado ✅ | Estrutura criada ✅ | **Falta:** Limpar Supabase e Vercel

---

## 🔴 PASSO 1: Resetar Banco de Dados Supabase (MANUAL)

O código foi deletado, mas o banco Supabase ainda tem dados antigos. Você precisa **resetar manualmente** (por segurança).

### Instruções:

1. **Acesse Supabase:**
   ```
   https://app.supabase.com
   ```

2. **Abra seu projeto GestEscolar**

3. **Vá para: Settings → Danger Zone**

4. **Clique em "Reset Database"**

5. **Confirme com seu email**

6. **Aguarde 2-3 minutos** (banco será totalmente limpado)

### ✅ O que será deletado:
- ✅ Todas as tabelas (schools, users, students, etc)
- ✅ Todos os dados
- ✅ Todas as RLS policies
- ✅ Todas as functions customizadas
- ❌ Sua conta Supabase (preservada)
- ❌ API keys (continuam iguais)

### ⚠️ Após reset:
```
- Novo banco estará vazio
- API keys (SUPABASE_URL, SUPABASE_KEY) continuam válidas
- Pronto para criar novas tabelas
```

---

## 🟠 PASSO 2: Limpar Vercel (Opcional mas Recomendado)

### Deletar Deployments Antigos:

1. **Acesse Vercel:**
   ```
   https://vercel.com/dashboard
   ```

2. **Clique no seu projeto (gestescolar)**

3. **Vá para: Deployments**

4. **Clique em cada deployment antigo**
   - Selecione: "Delete"
   - Confirme

### Atualizar Variáveis de Ambiente:

1. **Vá para: Settings → Environment Variables**

2. **Se o Supabase foi resetado, as variáveis mudaram?**
   - Copie novos valores de Supabase
   - Substitua em Vercel:
   ```
   SUPABASE_URL=https://seu-novo-projeto.supabase.co
   SUPABASE_KEY=eyJhbGc...
   ```

3. **Salve as mudanças**

---

## 🟢 PASSO 3: Confirmar que Tudo Está Limpo

### Verificar Supabase:

```sql
-- Acesse: Supabase → SQL Editor
-- Execute:

SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- Resultado esperado: 0 ou 1 (apenas default tables)
```

### Verificar Git Status:

```bash
cd C:\Users\valdir.reis\Documents\Projetos\gestescolar-main\.claude\worktrees\cranky-jepsen-e70774
git status
```

**Esperado:**
```
On branch main
Changes not staged for commit:
  deleted: api/...
  deleted: js/...
  deleted: css/...
  ...
```

---

## 📝 PASSO 4: Fazer Commit de Limpeza

Após resetar Supabase e limpar Vercel, registre a limpeza no Git:

```bash
git add .
git commit -m "chore: limpeza completa para refator v2

- Deletar codigo legado (js/, css/, api/)
- Recriar estrutura clean (backend/frontend)
- Backup preservado em BACKUPS/
- Supabase resetado
- Vercel limpo

Proxima etapa: Implementar Phase 0 com prompts"
```

---

## 🚀 PASSO 5: Pronto para Começar Reconstrução

Após completar todos os passos acima:

```
✅ Código antigo deletado
✅ Estrutura nova criada
✅ Supabase resetado
✅ Vercel limpo
✅ Git commitado

👉 AGORA VOCÊ PODE COMEÇAR A PHASE 0!
```

### Próximo Arquivo:
```
Abra: CONSTRUCAO_GESTESCOLAR_FASES.md

Procure: 🔵 PROMPT PARA PHASE 0: Setup Inicial

Copie, cole no Claude, implemente!
```

---

## ⏱️ Tempo Estimado:

| Tarefa | Tempo |
|--------|-------|
| Resetar Supabase | 5 min + espera 2-3 min |
| Limpar Vercel | 10 min |
| Verificar tudo | 5 min |
| Git commit | 2 min |
| **TOTAL** | **≈ 25 min** |

---

## 📞 Se algo der errado:

1. **Supabase não reseta?**
   - Tente novamente em Settings → Danger Zone
   - Ou contate suporte Supabase

2. **Variáveis de ambiente incorretas?**
   - Copie NOVAMENTE de Supabase → Settings → API
   - Cole em Vercel → Settings → Env Vars

3. **Precisa restaurar backup?**
   ```
   Seu backup está seguro em:
   C:\Users\valdir.reis\Documents\Projetos\BACKUPS\gestescolar-v1-20260601-010727
   ```

---

## ✨ Checklist Final

```
☐ Supabase resetado (banco vazio)
☐ Vercel limpo (sem deployments antigos)
☐ Variáveis de ambiente atualizadas
☐ Git status shows deleted files
☐ Git commit feito
☐ CONSTRUCAO_GESTESCOLAR_FASES.md aberto e pronto
☐ Backup localizado em BACKUPS/
☐ Prompts salvos em PROMPTS_RECONSTRUCAO/

✅ TUDO PRONTO PARA REFATORAÇÃO!
```

---

**Avance para FASE 0 quando tiver completado todos esses passos! 🚀**
