-- Armazena atestados médicos vinculados a registros de chamada (status='attested').
create table if not exists public.attendance_attestations (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null,
  student_id uuid not null,
  class_id   uuid not null,
  date       date not null,
  filename   text not null,
  file_size  int  not null,
  file_data  text not null, -- base64 encoded PDF
  uploaded_at timestamptz not null default now(),
  constraint uq_attestation unique (school_id, student_id, class_id, date)
);
