-- =============================================
--  GESTESCOLAR – Criar bucket de anexos de tickets
--  Execute no SQL Editor do Supabase Dashboard
-- =============================================

-- Criar bucket público para anexos de tickets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  true,
  5242880,  -- 5MB
  ARRAY['image/png','image/jpeg','image/webp','image/jpg']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Política: qualquer autenticado pode fazer upload
CREATE POLICY "Upload tickets autenticado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');

-- Política: qualquer um pode ler (bucket público)
CREATE POLICY "Leitura tickets publica" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'ticket-attachments');

-- Verificar
SELECT id, name, public FROM storage.buckets WHERE id = 'ticket-attachments';
