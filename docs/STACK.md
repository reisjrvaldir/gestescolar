# Arquitetura GestEscolar v2 — Stack Final

## Diagrama

```
┌──────────────────────┐     HTTPS + JWT      ┌──────────────────────┐
│  Frontend (React)    │ ───────────────────► │  Backend API (Node)  │
│  Vite + TS + Tailwind│                      │  serverless / Vercel │
│  Neon Auth (cliente) │ ◄─── login/JWT ────  │  valida JWT + RLS     │
└──────────────────────┘                      └──────────┬───────────┘
                                                          │ SQL (pooled)
                                                          ▼
                                              ┌──────────────────────┐
                                              │   Neon (Postgres)     │
                                              │   dados + neon_auth   │
                                              └──────────────────────┘
```

## Componentes

| Camada | Tecnologia | Observações |
|--------|-----------|-------------|
| Frontend | React + Vite + TypeScript + Tailwind | Design system próprio (azul/verde-água) |
| Auth | **Neon Auth** | Login, senha, JWT, reset. Usuários no schema `neon_auth` |
| Backend | Node (serverless na Vercel) | **Única** camada com acesso ao banco |
| Banco | **Neon** (Postgres serverless) | Connection string só no backend |
| Pagamentos | Nuvende | Camada de serviço + split (docs pendentes) |

## Regra de ouro

O **frontend nunca acessa o banco direto**. Todo dado passa pela API, que:
1. Valida o JWT do Neon Auth.
2. Resolve `profiles` → `school_id` + `role`.
3. Abre uma transação e injeta as session vars:
   ```sql
   select set_config('app.user_id',   $1, true);
   select set_config('app.school_id', $2, true);
   select set_config('app.user_role', $3, true);
   ```
4. Executa as queries — a **RLS** do Postgres garante o isolamento (defesa em profundidade), além do filtro explícito por `school_id` na própria query.

## Multi-tenant (decisão)

Padrão de mercado para Postgres serverless: **filtro por `school_id` na aplicação + RLS no banco** via session vars. Os dois juntos. Já implementado no `0001_init.sql`.

## Status

| Item | Estado |
|------|--------|
| Schema + RLS (`0001_init.sql`) | ✅ Neon-nativo |
| Design system + layout (frontend) | ✅ Verificado no preview |
| Client de API (frontend) | ✅ `src/lib/api.ts` |
| Integração Neon Auth | ⏳ Pendente (habilitar no console + gerar chaves) |
| Backend API (rotas) | ⏳ Próxima fase |
| Integração Nuvende | ⏳ Bloqueada (docs da API) |

## Pendências do usuário

1. **Criar o projeto/branch no Neon** e habilitar **Neon Auth** (gera as chaves do `.env`).
2. **Rodar a migration** `backend/src/db/migrations/0001_init.sql` no Neon.
3. **Docs da API Nuvende** (endpoints, auth, webhook) para a fase de pagamentos.
