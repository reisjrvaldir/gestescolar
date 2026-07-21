-- =============================================================
--  0020 — Ponto: habilitar batida + fluxo de aprovação (esquecimento).
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

-- Habilita/desabilita o funcionário para bater ponto.
alter table public.teachers add column if not exists timeclock_enabled boolean default true;

-- Fluxo de aprovação das batidas.
--   approval_status: 'auto' (dentro da janela) | 'pending' | 'approved' | 'rejected'
alter table public.timeclock_entries add column if not exists approval_status text default 'auto';
alter table public.timeclock_entries add column if not exists is_adjustment   boolean default false; -- esquecimento de ponto
alter table public.timeclock_entries add column if not exists justification    text;
alter table public.timeclock_entries add column if not exists reviewed_by      uuid;
alter table public.timeclock_entries add column if not exists reviewed_at      timestamptz;

-- Batidas existentes contam como já aprovadas (não travar histórico).
update public.timeclock_entries set approval_status = 'auto' where approval_status is null;
