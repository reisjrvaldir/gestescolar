-- =============================================
--  GESTESCOLAR – Migração: Campos Asaas Documentos & Verificação KYC
--  Executar no SQL Editor do Supabase Dashboard
-- =============================================

-- 1. Tipo de pessoa: 'PJ' (CNPJ Pessoa Jurídica), 'MEI' (Microempreendedor), 'CPF' (Pessoa Física)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS asaas_person_type TEXT
    CHECK (asaas_person_type IN ('PJ','MEI','CPF'));

-- 2. Status dos documentos:
--    - 'not_required'        → escola criada mas docs ainda não foram cobrados
--    - 'pending'             → aguardando upload do gestor
--    - 'pending_verification'→ docs enviados ao Asaas, aguardando validação
--    - 'verified'            → conta verificada e liberada
--    - 'rejected'            → docs reprovados, precisa reenviar
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS asaas_documents_status TEXT
    DEFAULT 'pending'
    CHECK (asaas_documents_status IN ('not_required','pending','pending_verification','verified','rejected'));

-- 3. JSON com URLs dos documentos enviados (storage paths) e metadata
--    Estrutura:
--    {
--      "identification": { "url": "...", "uploadedAt": "ISO", "fileName": "rg.pdf" },
--      "cpfCnpj":        { "url": "...", "uploadedAt": "ISO", "fileName": "..." },
--      "addressProof":   { "url": "...", "uploadedAt": "ISO", "fileName": "..." }
--    }
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS asaas_documents JSONB DEFAULT '{}'::jsonb;

-- 4. Mensagem da verificação do Asaas (motivo de rejeição, observações etc.)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS asaas_verification_message TEXT;

-- 5. Data em que o gestor enviou os documentos para verificação
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS asaas_documents_submitted_at TIMESTAMPTZ;

-- 6. Índice para consultas por status (usado em painéis de monitoramento)
CREATE INDEX IF NOT EXISTS idx_schools_asaas_documents_status
  ON public.schools(asaas_documents_status);

-- 7. Storage Bucket para documentos KYC (criar manualmente se ainda não existir)
--    Nome sugerido: 'school-documents'
--    Acesso: Privado (somente service role e gestores autenticados)
--    Política RLS: somente o gestor da escola pode ler/escrever documentos da sua escola
--    Aplicar manualmente no Supabase Storage Dashboard ou descomentar abaixo:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('school-documents', 'school-documents', false)
-- ON CONFLICT (id) DO NOTHING;

-- 8. Verificação
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'schools'
  AND column_name IN (
    'asaas_person_type',
    'asaas_documents_status',
    'asaas_documents',
    'asaas_verification_message',
    'asaas_documents_submitted_at'
  )
ORDER BY column_name;
