-- =============================================================
--  0031 — Notificações internas (sino no topo do app).
--
--  Genérica: qualquer fluxo de aprovação pode gerar uma notificação
--  (hoje: planejamento de aulas — tema, envio pra revisão, parecer,
--  comentário). `link` é uma rota do frontend (ex.: /app/lesson-plans/:id)
--  pra clicar e ir direto ao que motivou a notificação.
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor.
-- =============================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_recipient
  on public.notifications(school_id, profile_id, read_at, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists notifications_tenant on public.notifications;
create policy notifications_tenant on public.notifications for all
  using      (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());
