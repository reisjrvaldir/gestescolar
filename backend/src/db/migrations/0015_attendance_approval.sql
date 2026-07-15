-- Fluxo de aprovação de atestados: gestão aprova/recusa; aprovado vira "abono por atestado".
alter table public.attendance_attestations
  add column if not exists status text not null default 'pending', -- pending|approved|rejected
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists uploaded_by_guardian boolean not null default false;

create index if not exists idx_attestations_status on public.attendance_attestations(school_id, status);
