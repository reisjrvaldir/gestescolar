-- =============================================================
--  Migration 0005 — Staff v2 + Matrícula F + Messages + Leave + Documents
-- =============================================================

-- ---------- Contador global de matrícula F (funcionário) ----------
create table public._staff_matricula_counter (
  year        integer primary key,
  last_value  bigint  not null default 0,
  updated_at  timestamptz not null default now()
);

create or replace function public.next_staff_matricula()
returns text language plpgsql as $$
declare
  v_year  integer := extract(year from now())::int;
  v_value bigint;
begin
  insert into public._staff_matricula_counter (year, last_value)
    values (v_year, 1)
  on conflict (year) do update
    set last_value = public._staff_matricula_counter.last_value + 1,
        updated_at = now()
  returning last_value into v_value;

  return v_year::text || 'F' || lpad(v_value::text, 6, '0');
end;
$$;

-- ---------- Expansão de teachers (staff) ----------
alter table public.teachers
  add column cpf                  text,
  add column registration_number  text,
  add column role_type            text default 'teacher',
  add column subject_teaches      text;

-- garantir unicidade global (apenas onde registration_number não é nulo)
update public.teachers set registration_number = 'LEGACY-F-' || id::text
  where registration_number is null;
create unique index uq_teachers_registration_global on public.teachers(registration_number);

alter table public.profiles add column cpf text;

-- ---------- Mensagens (admin/professor ↔ responsável) ----------
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  student_id    uuid references public.students(id) on delete set null,
  subject       text not null,
  body          text not null,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index idx_messages_recipient on public.messages(recipient_id, created_at desc);
create index idx_messages_sender on public.messages(sender_id, created_at desc);

alter table public.messages enable row level security;
create policy messages_select on public.messages for select
  using (
    school_id = public.current_school_id() and (
      sender_id::text = (select id::text from public.profiles where auth_user_id = public.current_user_id())
      or recipient_id::text = (select id::text from public.profiles where auth_user_id = public.current_user_id())
      or public.is_superadmin()
    )
  );
create policy messages_insert on public.messages for insert
  with check (school_id = public.current_school_id() or public.is_superadmin());
create policy messages_update on public.messages for update
  using (
    school_id = public.current_school_id() and
    recipient_id::text = (select id::text from public.profiles where auth_user_id = public.current_user_id())
  );

-- ---------- Solicitações de folga / licença / férias ----------
create table public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  type          text not null check (type in ('folga','licenca','ferias')),
  start_date    date not null,
  end_date      date not null,
  reason        text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by    uuid references public.profiles(id),
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_leave_school_status on public.leave_requests(school_id, status, created_at desc);
create trigger leave_requests_updated before update on public.leave_requests
  for each row execute function public.set_updated_at();

alter table public.leave_requests enable row level security;
create policy leave_select on public.leave_requests for select
  using (school_id = public.current_school_id() or public.is_superadmin());
create policy leave_insert on public.leave_requests for insert
  with check (school_id = public.current_school_id() or public.is_superadmin());
create policy leave_update on public.leave_requests for update
  using (school_id = public.current_school_id() or public.is_superadmin());

-- ---------- Documentos do funcionário (certificados, atestados, etc.) ----------
create table public.staff_documents (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         text not null check (type in ('certificado','atestado','certidao','outro')),
  filename     text not null,
  mime_type    text,
  file_size    integer,
  file_data    text not null,           -- base64; MVP storage
  description  text,
  created_at   timestamptz not null default now()
);
create index idx_staff_docs_user on public.staff_documents(user_id, created_at desc);

alter table public.staff_documents enable row level security;
create policy staff_docs_select on public.staff_documents for select
  using (school_id = public.current_school_id() or public.is_superadmin());
create policy staff_docs_insert on public.staff_documents for insert
  with check (school_id = public.current_school_id() or public.is_superadmin());
create policy staff_docs_delete on public.staff_documents for delete
  using (school_id = public.current_school_id() or public.is_superadmin());
