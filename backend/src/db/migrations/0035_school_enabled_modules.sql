-- =============================================================
--  0035 — Módulos habilitados por escola.
--
--  Mapa { moduleKey: boolean } no JSONB. Ausência da chave = ativo.
--  Só armazenamos explicitamente `false` quando o gestor desativa.
--
--  Ex.: escolas que não usam ponto ficam com:
--       { "timeclock": false, "leave_requests": false }
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

alter table public.schools
  add column if not exists enabled_modules jsonb not null default '{}'::jsonb;
