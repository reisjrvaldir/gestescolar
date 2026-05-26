# Contribuindo para o GestEscolar

Este documento descreve as convenções e processos para contribuir com o projeto.

## Padrão de Commits (Conventional Commits)

Mensagens de commit devem seguir o formato:

```
tipo(escopo): descrição
```

### Tipos válidos

| Tipo       | Quando usar                                                     |
|------------|-----------------------------------------------------------------|
| `feat`     | Nova funcionalidade visível ao usuário                          |
| `fix`      | Correção de bug                                                 |
| `refactor` | Refatoração sem mudança de comportamento                        |
| `docs`     | Apenas documentação (README, CONTRIBUTING, JSDoc)               |
| `chore`    | Manutenção (deps, configs, build)                               |
| `test`     | Adição ou correção de testes                                    |
| `style`    | Formatação, espaços (sem mudança lógica)                        |
| `perf`     | Melhoria de performance                                         |
| `ci`       | Mudanças em GitHub Actions, workflows                           |
| `build`    | Mudanças em sistema de build                                    |
| `revert`   | Reverte um commit anterior                                      |

### Escopo (opcional)

O escopo indica a área afetada. Exemplos comuns no projeto:
- `payment` - sistema de pagamento (webhook, Asaas, planos)
- `auth` - autenticação e sessão
- `router` - roteamento e navegação
- `plans` - definições e bloqueio de planos
- `webhook` - webhook do Asaas
- `ui` - componentes visuais
- `db` - acesso a dados/Supabase

### Exemplos válidos

```
feat(auth): adicionar reset de senha por email
fix(payment): webhook ativa plano após PIX confirmado
refactor(plans): extrair lógica de bloqueio para helper
docs(readme): atualizar instruções de deploy
chore: bump @supabase/supabase-js para 2.105
test(webhook): adicionar caso de pagamento duplicado
ci: adicionar typecheck no workflow
```

### Exemplos inválidos

```
Adicionei reset de senha          → sem tipo
fix: arrumei                       → descrição vazia/inútil
update                             → sem tipo nem descrição clara
WIP                                → não usar WIP, faça um draft PR
```

### Mudanças breaking

Adicione `!` após o tipo/escopo:

```
feat(api)!: mudar formato de resposta do endpoint /invoices
```

### Corpo do commit (opcional)

Para mudanças complexas, adicione corpo explicando o **porquê**:

```
fix(payment): impedir ativação dupla de plano

Webhook pode chegar 2x em race condition com polling do
frontend. Adiciona check de idempotência via audit_log.

Reproduz: pagar via PIX e atualizar página rapidamente.
```

## Code Review Automático

Todo PR para `main` é validado automaticamente:

1. **Sintaxe JS** - `node --check` em todos os arquivos
2. **Type Check** - `npm run typecheck` (TypeScript checkJs)
3. **Qualidade** - detecta `console.log`, TODOs, arquivos grandes
4. **Segurança** - detecta credenciais hardcoded
5. **Commit Lint** - valida que todos os commits seguem o padrão

Falhas em segurança/sintaxe **bloqueiam** o merge.
Avisos de qualidade são informativos.

## Como Rodar Localmente

```bash
# Verificar sintaxe
node --check js/plans.js

# Verificar tipos
npm run typecheck

# Validar último commit
git log -1 --format="%s" | grep -qE '^(feat|fix|refactor|docs|chore|test|style|perf|ci|build|revert)(\([a-z0-9_-]+\))?!?:\ .+' \
  && echo "OK" || echo "Fora do padrão"
```

## Fluxo de Desenvolvimento

1. Crie uma branch a partir de `main`:
   ```
   git checkout main && git pull
   git checkout -b feat/nome-da-feature
   ```

2. Faça commits seguindo o padrão acima.

3. Abra PR contra `main`. Aguarde os checks passarem.

4. Após aprovação, faça merge (squash recomendado para manter histórico limpo).

## Segurança

- **NUNCA** commite credenciais (.env, tokens, senhas, chaves API)
- Use `process.env.NOME_DA_VAR` para acessar segredos
- Reporte vulnerabilidades em privado ao mantenedor antes de abrir issue pública
