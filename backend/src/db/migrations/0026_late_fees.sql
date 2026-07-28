-- =============================================================
--  0026 — Multa e juros por atraso, por escola.
--
--  late_fine_pct     — multa (percentual FIXO aplicado uma vez após o vencimento)
--  late_interest_pct — juros de mora (percentual AO MÊS, o ASAAS aplica pro-rata/dia)
--
--  As taxas são repassadas ao provedor (ASAAS) na criação da cobrança; ele
--  aplica automaticamente quando o pagamento ocorre após a data de vencimento.
--
--  Aditivo. Aplicar manualmente no Neon SQL Editor (NÃO rodar npm run migrate).
-- =============================================================

alter table public.schools
  add column if not exists late_fine_pct     numeric(5,2) not null default 0,
  add column if not exists late_interest_pct numeric(5,2) not null default 0;

-- Sanidade: percentuais entre 0 e 100.
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
     where table_schema='public' and table_name='schools' and constraint_name='schools_late_fine_pct_range'
  ) then
    alter table public.schools
      add constraint schools_late_fine_pct_range     check (late_fine_pct     >= 0 and late_fine_pct     <= 100),
      add constraint schools_late_interest_pct_range check (late_interest_pct >= 0 and late_interest_pct <= 100);
  end if;
end $$;
