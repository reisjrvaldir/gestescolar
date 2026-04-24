-- Adiciona coluna para armazenar a API Key da subconta Asaas de cada escola
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS asaas_sub_api_key TEXT;
