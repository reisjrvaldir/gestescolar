-- Calendário escolar (eventos, feriados, provas, reuniões)
create table public.school_calendar (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  title       text not null,
  description text,
  date_start  date not null,
  date_end    date,
  event_type  text not null default 'event', -- holiday|exam|meeting|event|recess
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_calendar_school on public.school_calendar(school_id);
alter table public.school_calendar enable row level security;
create policy calendar_tenant on public.school_calendar for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

-- Ponto eletrônico
create table public.timeclock_entries (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  clock_in    timestamptz not null default now(),
  clock_out   timestamptz,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_timeclock_school on public.timeclock_entries(school_id);
create index idx_timeclock_user   on public.timeclock_entries(user_id);
alter table public.timeclock_entries enable row level security;
create policy timeclock_tenant on public.timeclock_entries for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

-- Jornadas de trabalho (escala semanal)
create table public.work_schedules (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  weekday     integer not null check (weekday between 0 and 6), -- 0=dom, 1=seg...6=sáb
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, user_id, weekday)
);

create index idx_schedules_school on public.work_schedules(school_id);
alter table public.work_schedules enable row level security;
create policy schedules_tenant on public.work_schedules for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

-- Triggers updated_at
create trigger trg_school_calendar_updated before update on public.school_calendar
  for each row execute function public.set_updated_at();
create trigger trg_timeclock_entries_updated before update on public.timeclock_entries
  for each row execute function public.set_updated_at();
create trigger trg_work_schedules_updated before update on public.work_schedules
  for each row execute function public.set_updated_at();
