# GestEscolar v2

Plataforma SaaS de Gestão Escolar — reconstrução do zero.

## Status

🏗️ **Em reconstrução** — código legado removido, estrutura limpa pronta.

## Estrutura

```
.
├── backend/          # API + Agents (Node/TypeScript)
│   └── src/
│       ├── agents/   # Lógica de negócio
│       ├── api/      # Endpoints REST
│       └── db/       # Schemas e migrations
├── frontend/         # SPA (Vite/TypeScript)
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── stores/
│       ├── services/
│       ├── styles/
│       ├── types/
│       └── utils/
└── docs/             # Documentação e prompts de construção
```

## Como reconstruir

Os prompts de construção fase a fase estão em:
- `CONSTRUCAO_GESTESCOLAR_FASES.md` — guia com 7 fases e 20+ prompts
- `PROXIMOS_PASSOS.md` — checklist de reset de infraestrutura (Supabase/Vercel)

Comece pela **Fase 0** e avance sequencialmente.

## Documentação de referência (v1)

Mantida para consulta durante a reconstrução:
- `ANALISE_GESTESCOLAR.docx` — análise competitiva e roadmap
- `RPD.md` — Registro de Processamento de Dados (LGPD)
- `PRIVACY.md` / `INCIDENT_RESPONSE.md` — conformidade
- `TESTE_MANUAL.md` / `PLANO_TESTES_MVP.md` — planos de teste

## Backup

O código v1 completo está em:
`../../../../BACKUPS/gestescolar-v1-20260601-010727/`
