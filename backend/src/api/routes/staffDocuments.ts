import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';

export const staffDocumentsRouter = Router();
staffDocumentsRouter.use(requireAuth);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB (do payload original — base64 fica ~2.7MB)

const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const docSchema = z.object({
  type: z.enum(['certificado', 'atestado', 'certidao', 'outro']),
  filename: z.string().min(1).max(200),
  mime_type: z.enum(ALLOWED_MIMES as [string, ...string[]], { errorMap: () => ({ message: 'Tipo de arquivo não permitido. Use PDF, JPEG ou PNG.' }) }),
  file_data: z.string().min(10),
  file_size: z.number().int().positive(),
  description: z.string().optional(),
});

// GET /api/staff-documents — meus docs (ou de qualquer user se admin)
staffDocumentsRouter.get('/', async (req, res) => {
  const userId = req.query.user_id as string | undefined;
  const isAdmin = ['school_admin', 'superadmin'].includes(req.ctx!.role);
  const targetUserId = isAdmin && userId ? userId : req.ctx!.profileId;
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, type, filename, mime_type, file_size, description, created_at
         from public.staff_documents
        where school_id = $1 and user_id = $2
        order by created_at desc`,
      [req.ctx!.schoolId, targetUserId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /api/staff-documents/:id — baixar o arquivo (com file_data base64)
staffDocumentsRouter.get('/:id', async (req, res) => {
  const isAdmin = ['school_admin', 'superadmin'].includes(req.ctx!.role);
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, type, filename, mime_type, file_size, file_data, description, created_at, user_id
         from public.staff_documents
        where id=$1 and school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
    return rows[0];
  });
  if (!data) return res.status(404).json({ code: 'not_found' });
  if (!isAdmin && data.user_id !== req.ctx!.profileId) {
    return res.status(403).json({ code: 'forbidden' });
  }
  res.json({ ok: true, data });
});

staffDocumentsRouter.post('/', async (req, res) => {
  const p = docSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  if (p.data.file_size && p.data.file_size > MAX_FILE_SIZE) {
    return res.status(413).json({ code: 'file_too_large', message: 'Arquivo excede 2MB' });
  }
  // base64 inflado ~33%: validar tamanho aproximado também
  if (p.data.file_data.length > MAX_FILE_SIZE * 1.4) {
    return res.status(413).json({ code: 'file_too_large', message: 'Arquivo excede 2MB' });
  }
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.staff_documents
         (school_id, user_id, type, filename, mime_type, file_size, file_data, description)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, type, filename, mime_type, file_size, description, created_at`,
      [req.ctx!.schoolId, req.ctx!.profileId, p.data.type, p.data.filename,
       p.data.mime_type ?? null, p.data.file_size ?? null,
       p.data.file_data, p.data.description ?? null],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

staffDocumentsRouter.delete('/:id', async (req, res) => {
  const isAdmin = ['school_admin', 'superadmin'].includes(req.ctx!.role);
  await withTenant(req.ctx!, async (c) => {
    const filter = isAdmin ? '' : ' and user_id = $3';
    const params: unknown[] = [req.params.id, req.ctx!.schoolId];
    if (!isAdmin) params.push(req.ctx!.profileId);
    await c.query(
      `delete from public.staff_documents where id=$1 and school_id=$2${filter}`,
      params,
    );
  });
  res.status(204).end();
});
