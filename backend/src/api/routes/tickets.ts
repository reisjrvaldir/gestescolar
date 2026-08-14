import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

const ADMIN_ROLES = ['school_admin', 'superadmin'] as const;
const isAdmin = (role: string) => (ADMIN_ROLES as readonly string[]).includes(role);

// GET /api/tickets — lista tickets.
// Admin vê todos da escola; não-admin vê apenas os que abriu.
ticketsRouter.get('/', async (req, res) => {
  const { role, profileId, schoolId } = req.ctx!;
  const data = await withTenant(req.ctx!, async (c) => {
    const ownerClause = isAdmin(role) ? '' : ' AND t.opened_by = $2';
    const params = isAdmin(role) ? [schoolId] : [schoolId, profileId];
    const { rows } = await c.query(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.category,
              coalesce(t.attachments, '[]'::jsonb) AS attachments, t.created_at,
              p.name AS opened_by_name
         FROM public.support_tickets t
         LEFT JOIN public.profiles p ON p.id = t.opened_by AND p.school_id = t.school_id
        WHERE t.school_id = $1${ownerClause}
        ORDER BY t.created_at DESC`,
      params,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /api/tickets/:id — detalhe + comentários.
// Admin vê qualquer ticket da escola; não-admin só o que abriu.
ticketsRouter.get('/:id', async (req, res) => {
  const { role, profileId, schoolId } = req.ctx!;
  const data = await withTenant(req.ctx!, async (c) => {
    const ownerClause = isAdmin(role) ? '' : ' AND t.opened_by = $3';
    const params = isAdmin(role)
      ? [req.params.id, schoolId]
      : [req.params.id, schoolId, profileId];
    const ticket = await c.query(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.category,
              coalesce(t.attachments, '[]'::jsonb) AS attachments, t.created_at,
              p.name AS opened_by_name
         FROM public.support_tickets t
         LEFT JOIN public.profiles p ON p.id = t.opened_by AND p.school_id = t.school_id
        WHERE t.id = $1 AND t.school_id = $2${ownerClause}`,
      params,
    );
    if (ticket.rows.length === 0) return null;
    const comments = await c.query(
      `SELECT tc.id, tc.message, tc.created_at, p.name AS user_name
         FROM public.ticket_comments tc
         LEFT JOIN public.profiles p ON p.id = tc.user_id AND p.school_id = $2
        WHERE tc.ticket_id = $1
        ORDER BY tc.created_at ASC`,
      [req.params.id, schoolId],
    );
    return { ...ticket.rows[0], comments: comments.rows };
  });
  if (!data) return res.status(404).json({ code: 'not_found' });
  res.json({ ok: true, data });
});

const ticketSchema = z.object({
  title: z.string().min(3, 'Informe o título'),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  attachments: z.array(z.string()).max(5).optional(),
});

ticketsRouter.post('/', async (req, res) => {
  const p = ticketSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO public.support_tickets (school_id, opened_by, title, description, category, priority, attachments)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, status, priority, category, attachments, created_at`,
      [req.ctx!.schoolId, req.ctx!.profileId, p.data.title, p.data.description ?? null,
       p.data.category ?? null, p.data.priority ?? 'normal',
       JSON.stringify(p.data.attachments ?? [])],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

const commentSchema = z.object({ message: z.string().min(1) });

// POST /api/tickets/:id/comments — comentar num ticket.
// Admin comenta em qualquer ticket da escola; não-admin só no próprio.
ticketsRouter.post('/:id/comments', async (req, res) => {
  const p = commentSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const { role, profileId, schoolId } = req.ctx!;
  const created = await withTenant(req.ctx!, async (c) => {
    const ownerClause = isAdmin(role) ? '' : ' AND opened_by = $3';
    const params = isAdmin(role)
      ? [req.params.id, schoolId]
      : [req.params.id, schoolId, profileId];
    const owns = await c.query(
      `SELECT 1 FROM public.support_tickets WHERE id=$1 AND school_id=$2${ownerClause} LIMIT 1`,
      params,
    );
    if (owns.rows.length === 0) return null;
    const { rows } = await c.query(
      `INSERT INTO public.ticket_comments (ticket_id, user_id, message)
       VALUES ($1, $2, $3) RETURNING id, message, created_at`,
      [req.params.id, profileId, p.data.message],
    );
    return rows[0];
  });
  if (!created) return res.status(404).json({ code: 'not_found' });
  res.status(201).json({ ok: true, data: created });
});

// PATCH /api/tickets/:id/close — fechar ticket.
// Somente o criador OU admin podem fechar.
ticketsRouter.patch('/:id/close', async (req, res) => {
  const { role, profileId, schoolId } = req.ctx!;
  const result = await withTenant(req.ctx!, async (c) => {
    const check = await c.query(
      `SELECT opened_by FROM public.support_tickets WHERE id=$1 AND school_id=$2 LIMIT 1`,
      [req.params.id, schoolId],
    );
    if (check.rows.length === 0) return { error: 'not_found' as const };
    if (!isAdmin(role) && check.rows[0].opened_by !== profileId) {
      return { error: 'forbidden' as const };
    }
    await c.query(
      `UPDATE public.support_tickets SET status='closed' WHERE id=$1 AND school_id=$2`,
      [req.params.id, schoolId],
    );
    return { ok: true };
  });
  if ('error' in result) {
    if (result.error === 'not_found') return res.status(404).json({ code: 'not_found' });
    return res.status(403).json({ code: 'forbidden', message: 'Somente o criador do ticket ou um administrador pode fechá-lo.' });
  }
  res.json({ ok: true });
});
