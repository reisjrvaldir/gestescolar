-- =============================================================
--  GestEscolar v2 — Migration inicial (NEON + Neon Auth)
--  Schema multi-tenant + RLS por session vars + funções de segurança
--
--  Stack: React → Backend API (Node) → Neon Postgres
--  Auth:  Neon Auth. O backend valida a sessão/JWT do Neon Auth e, por
--         transação, injeta as session vars usadas pela RLS:
--           select set_config('app.user_id',   <id>,    true);
--           select set_config('app.school_id', <uuid>,  true);
--           select set_config('app.user_role', <role>,  true);
--         (is_local = true → compatível com pooling em transaction mode)
-- =============================================================

-- ---------- Extensões ----------
create extension if not exists "pgcrypto";

-- =============================================================
--  FUNÇÕES DE SEGURANÇA (lidas das session vars setadas pelo backend)
-- =============================================================
create or replace function public.current_user_id()
returns text language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')
$$;

create or replace function public.current_school_id()
returns uuid language sql stable as $$
  select nullif(current_setting('app.school_id', true), '')::uuid
$$;

create or replace function public.current_role_name()
returns text language sql stable as $$
  select coalesce(nullif(current_setting('app.user_role', true), ''), 'anon')
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable as $$
  select coalesce(current_setting('app.user_role', true), '') = 'superadmin'
$$;

-- helper para updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
--  PLANOS (globais — sem school_id)
-- =============================================================
create table public.plans (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  student_limit       integer,                 -- null = ilimitado
  monthly_price       numeric(10,2) not null default 0,
  annual_price        numeric(10,2) not null default 0,
  discount_percentage numeric(5,2)  not null default 15,
  is_public           boolean not null default true,
  is_pilot            boolean not null default false,
  features_json       jsonb   not null default '[]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- =============================================================
--  ESCOLAS (tenant raiz)
-- =============================================================
create table public.schools (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  legal_name            text,
  cnpj                  text,
  email                 text,
  phone                 text,
  logo_url              text,
  status                text not null default 'active',   -- active|blocked|suspended
  plan_id               uuid references public.plans(id),
  trial_ends_at         timestamptz,
  subscription_status   text default 'trialing',          -- trialing|active|past_due|canceled
  nuvende_account_id    text,
  nuvende_account_status text default 'not_started',       -- not_started|pending|in_review|approved|rejected|blocked
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- =============================================================
--  PERFIS DE USUÁRIO (1:1 com usuário do Neon Auth)
-- =============================================================
-- auth_user_id = id do usuário no Neon Auth (tipo text). Vínculo lógico
-- (sem FK física, pois o schema neon_auth é gerenciado pelo provedor de auth).
create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  text unique,
  school_id     uuid references public.schools(id) on delete cascade,
  name          text,
  email         text,
  phone         text,
  role          text not null default 'guardian',  -- superadmin|school_admin|financial|teacher|guardian
  avatar_url    text,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- =============================================================
--  ACADÊMICO
-- =============================================================
create table public.guardians (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  user_id     uuid references public.profiles(id),
  name        text not null,
  email       text,
  phone       text,
  cpf         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.teachers (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  user_id     uuid references public.profiles(id),
  name        text not null,
  email       text,
  phone       text,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  year        integer,
  level       text,
  shift       text,
  teacher_id  uuid references public.teachers(id),
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.students (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  name                text not null,
  birth_date          date,
  registration_number text,
  class_id            uuid references public.classes(id),
  guardian_id         uuid references public.guardians(id),
  status              text not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.grades (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  class_id    uuid references public.classes(id),
  subject_id  uuid references public.subjects(id),
  teacher_id  uuid references public.teachers(id),
  period      text,
  grade       numeric(5,2),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.attendance (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  class_id      uuid references public.classes(id),
  teacher_id    uuid references public.teachers(id),
  date          date not null,
  status        text not null,           -- present|absent|justified
  justification text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- =============================================================
--  FINANCEIRO + PAGAMENTOS / SPLIT
-- =============================================================
create table public.invoices (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  student_id        uuid references public.students(id),
  guardian_id       uuid references public.guardians(id),
  amount            numeric(10,2) not null,
  due_date          date,
  status            text not null default 'pending',  -- pending|paid|overdue|cancelled|refunded
  payment_method    text,                              -- pix|card
  nuvende_charge_id text,
  pix_qr_code       text,
  pix_copy_paste    text,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  invoice_id          uuid references public.invoices(id),
  student_id          uuid references public.students(id),
  guardian_id         uuid references public.guardians(id),
  gross_amount        numeric(10,2) not null,
  payment_method      text,
  provider            text not null default 'nuvende',
  provider_payment_id text,
  provider_charge_id  text,
  status              text not null default 'pending',
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Split: regra PIX = R$1,99 (Nuvende) + 3% (plataforma)
create table public.payment_splits (
  id                      uuid primary key default gen_random_uuid(),
  school_id               uuid not null references public.schools(id) on delete cascade,
  payment_id              uuid references public.payments(id) on delete cascade,
  invoice_id              uuid references public.invoices(id),
  gross_amount            numeric(10,2) not null,
  nuvende_pix_fee         numeric(10,2) not null default 1.99,
  platform_fee_percentage numeric(5,4)  not null default 0.0300,
  platform_fee_amount     numeric(10,2) not null,
  total_service_fee       numeric(10,2) not null,
  school_net_amount       numeric(10,2) not null,
  split_status            text not null default 'pending',  -- pending|reconciled|failed
  provider_split_id       text,
  reconciled_at           timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.school_balances (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null unique references public.schools(id) on delete cascade,
  available_balance    numeric(12,2) not null default 0,
  pending_balance      numeric(12,2) not null default 0,
  gross_received_total numeric(12,2) not null default 0,
  platform_fees_total  numeric(12,2) not null default 0,
  provider_fees_total  numeric(12,2) not null default 0,
  withdrawn_total      numeric(12,2) not null default 0,
  updated_at           timestamptz not null default now()
);

create table public.withdrawals (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id) on delete cascade,
  amount               numeric(12,2) not null,
  status               text not null default 'requested',  -- requested|processing|paid|failed|cancelled
  nuvende_withdrawal_id text,
  requested_by         uuid references public.profiles(id),
  requested_at         timestamptz not null default now(),
  paid_at              timestamptz,
  failed_reason        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.expenses (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  supplier_name       text,
  description         text,
  amount              numeric(10,2) not null,
  installments        integer default 1,
  current_installment integer default 1,
  due_date            date,
  status              text not null default 'pending',  -- pending|paid|overdue
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- =============================================================
--  CONTA NUVENDE (validação de recebimento) + DOCUMENTOS
-- =============================================================
create table public.nuvende_accounts (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null unique references public.schools(id) on delete cascade,
  provider_account_id text,
  status              text not null default 'not_started',
  legal_name          text,
  cnpj                text,
  responsible_name    text,
  responsible_cpf     text,
  email               text,
  phone               text,
  pix_key_type        text,
  pix_key             text,
  bank_data_json      jsonb,
  requirements_json   jsonb,
  last_sync_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.nuvende_documents (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id) on delete cascade,
  nuvende_account_id   uuid references public.nuvende_accounts(id) on delete cascade,
  document_type        text not null,
  file_url             text,
  status               text not null default 'pending',
  provider_document_id text,
  rejection_reason     text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- =============================================================
--  ASSINATURAS SaaS
-- =============================================================
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  school_id              uuid not null references public.schools(id) on delete cascade,
  plan_id                uuid references public.plans(id),
  status                 text not null default 'trialing',
  billing_cycle          text not null default 'monthly',  -- monthly|annual
  amount                 numeric(10,2),
  trial_ends_at          timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  nuvende_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- =============================================================
--  SUPORTE / TICKETS
-- =============================================================
create table public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid references public.schools(id) on delete cascade,
  opened_by   uuid references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  title       text not null,
  description text,
  status      text not null default 'open',     -- open|in_progress|waiting_customer|resolved|reopened|closed
  priority    text not null default 'normal',    -- low|normal|high|urgent
  category    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.ticket_comments (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.support_tickets(id) on delete cascade,
  user_id        uuid references public.profiles(id),
  message        text not null,
  attachment_url text,
  created_at     timestamptz not null default now()
);

-- =============================================================
--  AUDITORIA + LGPD
-- =============================================================
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid references public.schools(id) on delete set null,
  user_id     uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);

create table public.lgpd_requests (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid references public.schools(id) on delete set null,
  user_id      uuid references public.profiles(id) on delete set null,
  request_type text not null,   -- export|deletion
  status       text not null default 'pending',
  response_url text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- =============================================================
--  ÍNDICES
-- =============================================================
create index idx_profiles_school   on public.profiles(school_id);
create index idx_profiles_auth      on public.profiles(auth_user_id);
create index idx_students_school    on public.students(school_id);
create index idx_classes_school     on public.classes(school_id);
create index idx_grades_student     on public.grades(student_id);
create index idx_attendance_student on public.attendance(student_id);
create index idx_invoices_school    on public.invoices(school_id);
create index idx_invoices_due       on public.invoices(due_date);
create index idx_payments_school    on public.payments(school_id);
create index idx_splits_school      on public.payment_splits(school_id);
create index idx_withdrawals_school on public.withdrawals(school_id);
create index idx_expenses_school    on public.expenses(school_id);
create index idx_tickets_school     on public.support_tickets(school_id);
create index idx_audit_school       on public.audit_logs(school_id);

-- =============================================================
--  TRIGGERS updated_at
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'plans','schools','profiles','guardians','teachers','classes','students',
    'grades','attendance','invoices','payments','payment_splits','withdrawals',
    'expenses','nuvende_accounts','nuvende_documents','subscriptions','support_tickets'
  ]
  loop
    execute format(
      'create trigger trg_%s_updated before update on public.%I
       for each row execute function public.set_updated_at()', t, t);
  end loop;
end$$;

-- =============================================================
--  RLS — habilita em todas as tabelas tenant
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'schools','profiles','guardians','teachers','classes','subjects','students',
    'grades','attendance','invoices','payments','payment_splits','school_balances',
    'withdrawals','expenses','nuvende_accounts','nuvende_documents','subscriptions',
    'support_tickets','ticket_comments','audit_logs','lgpd_requests'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end$$;

-- Plans: leitura pública (landing/planos), escrita só superadmin
alter table public.plans enable row level security;
create policy plans_read   on public.plans for select using (true);
create policy plans_write  on public.plans for all
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Schools: superadmin tudo; usuário vê/edita a própria escola
create policy schools_sa   on public.schools for all
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy schools_self on public.schools for select
  using (id = public.current_school_id());
create policy schools_self_upd on public.schools for update
  using (id = public.current_school_id() and public.current_role_name() in ('school_admin'))
  with check (id = public.current_school_id());

-- Profiles: superadmin tudo; usuário vê os perfis da própria escola; vê o próprio
create policy profiles_sa   on public.profiles for all
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy profiles_school on public.profiles for select
  using (school_id = public.current_school_id());
create policy profiles_self on public.profiles for select
  using (auth_user_id = public.current_user_id());

-- Padrão multi-tenant: school_id = current_school_id() (ou superadmin)
-- Aplicado a todas as tabelas com school_id
do $$
declare t text;
begin
  foreach t in array array[
    'guardians','teachers','classes','subjects','students','grades','attendance',
    'invoices','payments','payment_splits','school_balances','withdrawals','expenses',
    'nuvende_accounts','nuvende_documents','subscriptions','audit_logs','lgpd_requests'
  ]
  loop
    execute format(
      'create policy %1$s_tenant on public.%1$I for all
         using (public.is_superadmin() or school_id = public.current_school_id())
         with check (public.is_superadmin() or school_id = public.current_school_id())',
      t);
  end loop;
end$$;

-- Tickets: tenant + superadmin (superadmin vê todos, inclusive school_id null)
create policy tickets_sa     on public.support_tickets for all
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy tickets_tenant on public.support_tickets for all
  using (school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- Comentários de ticket: acompanha o ticket
create policy ticket_comments_access on public.ticket_comments for all
  using (
    public.is_superadmin() or exists (
      select 1 from public.support_tickets st
      where st.id = ticket_id and st.school_id = public.current_school_id()
    )
  )
  with check (
    public.is_superadmin() or exists (
      select 1 from public.support_tickets st
      where st.id = ticket_id and st.school_id = public.current_school_id()
    )
  );

-- =============================================================
--  SEED — planos padrão
-- =============================================================
insert into public.plans (name, student_limit, monthly_price, annual_price, is_public, is_pilot, features_json) values
  ('Free',       5,    0.00,    0.00,    true,  false, '["Cadastro de alunos","Cadastro automático de responsáveis"]'),
  ('100 Alunos', 100,  149.90,  1528.98, true,  false, '["Financeiro","PIX","Documentos","Suporte via ticket"]'),
  ('250 Alunos', 250,  249.90,  2548.98, true,  false, '["Tudo do 100","Suporte WhatsApp"]'),
  ('Ilimitado',  null, 399.90,  4078.98, true,  false, '["Tudo do 250","Relatórios avançados","API"]'),
  ('Piloto',     null, 0.00,    0.00,    false, true,  '["Acesso completo — parceiro piloto"]');

-- FIM da migration 0001
