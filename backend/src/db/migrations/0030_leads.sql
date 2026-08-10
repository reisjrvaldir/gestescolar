-- =============================================================
--  0030 — Leads do popup de teste controlado (landing page).
--
--  Não é tenant-scoped: um lead ainda não é escola, é prospect.
--  Consultado só pelo superadmin (POST público, GET/PATCH em /saas).
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text,
  school_name text,
  message     text,
  source      text not null default 'landing_popup',
  status      text not null default 'new'
              check (status in ('new','contacted','converted','discarded')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_leads_status_created on public.leads(status, created_at desc);
