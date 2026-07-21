-- =============================================================
--  0021 — RLS gap-fill (pré-requisito do enforcement, Fase B.2 do runbook)
--
--  Fecha as tabelas de tenant criadas DEPOIS da 0011 que ainda não têm policy
--  e/ou não estavam na lista de FORCE. Aditivo e inócuo com o role atual
--  (neondb_owner tem bypassrls). Aplicar manualmente no Neon, junto da 0011.
-- =============================================================

-- 1) attendance_attestations: não tinha RLS nem policy. Isola por escola.
alter table public.attendance_attestations enable row level security;
drop policy if exists attendance_attestations_tenant on public.attendance_attestations;
create policy attendance_attestations_tenant on public.attendance_attestations for all
  using (public.is_superadmin() or school_id = public.current_school_id())
  with check (public.is_superadmin() or school_id = public.current_school_id());

-- 2) FORCE nas tabelas de tenant criadas após a 0011 (já têm policy própria).
do $$
declare
  t text;
  extra_tables text[] := array[
    'attendance_attestations','class_subjects','school_grade_settings'
  ];
begin
  foreach t in array extra_tables loop
    if exists (select 1 from information_schema.tables
                where table_schema='public' and table_name=t) then
      execute format('alter table public.%I force row level security', t);
    end if;
  end loop;
end$$;
