-- =============================================
--  GESTESCOLAR – TABELA PLATFORM_SETTINGS
--  Configurações globais da plataforma (email, etc)
-- =============================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group"    TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE("group", key)
);

-- RLS: apenas superadmin lê/escreve
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings_superadmin" ON public.platform_settings
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'superadmin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'superadmin'));

-- Service role (webhook/api) pode ler sem restrição RLS
-- (service key bypassa RLS automaticamente no Supabase)

-- Defaults iniciais de email
INSERT INTO public.platform_settings ("group", key, value) VALUES
  ('email', 'senderName',    'GestEscolar'),
  ('email', 'senderEmail',   'noreply@gestescolar.com.br'),
  ('email', 'primaryColor',  '#1a73e8'),
  ('email', 'logoUrl',       ''),
  ('email', 'supportEmail',  'suporte@gestescolar.com.br'),
  ('email', 'whatsapp',      ''),
  ('email', 'instagram',     ''),
  ('email', 'footerAddress', ''),
  ('email', 'footerCnpj',    '')
ON CONFLICT ("group", key) DO NOTHING;
