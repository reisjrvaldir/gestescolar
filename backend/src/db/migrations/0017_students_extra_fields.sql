-- Campos adicionais para o aluno: RG, tipo sanguíneo, naturalidade e foto
alter table public.students
  add column if not exists rg           text,
  add column if not exists blood_type   text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  add column if not exists naturality   text,
  add column if not exists photo_url    text;

-- Contatos do responsável: telefone secundário
alter table public.guardians
  add column if not exists phone2 text;

insert into public._migrations (name) values ('0017_students_extra_fields.sql') on conflict (name) do nothing;
