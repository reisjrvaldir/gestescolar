import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

ticketsRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select t.id, t.title, t.description, t.status, t.priority, t.category, t.created_at,
              p.name as opened_by_name
         from public.support_tickets t
         left join public.profiles p on p.id = t.opened_by
        where t.school_id = $1
        order by t.created_at desc`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

ticketsRouter.get('/:id', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const ticket = await c.query(
      `select t.id, t.title, t.description, t.status, t.priority, t.category, t.created_at,
              p.name as opened_by_name
         from public.support_tickets t
         left join public.profiles p on p.id = t.opened_by
        where t.id = $1 and t.school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
    if (ticket.rows.length === 0) return null;
    const comments = await c.query(
      `select tc.id, tc.message, tc.created_at, p.name as user_name
         from public.ticket_comments tc
         left join public.profiles p on p.id = tc.user_id
        where tc.ticket_id = $1
        order by tc.created_at asc`,
      [req.params.id],
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
});

ticketsRouter.post('/', async (req, res) => {
  const p = ticketSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const profileId = req.ctx!.profileId;
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.support_tickets (school_id, opened_by, title, description, category, priority)
       values ($1, $2, $3, $4, $5, $6)
       returning id, title, status, priority, created_at`,
      [req.ctx!.schoolId, profileId, p.data.title, p.data.description ?? null,
       p.data.category ?? null, p.data.priority ?? 'normal'],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

const commentSchema = z.object({ message: z.string().min(1) });

ticketsRouter.post('/:id/comments', async (req, res) => {
  const p = commentSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.ticket_comments (ticket_id, user_id, message)
       values ($1, $2, $3) returning id, message, created_at`,
      [req.params.id, req.ctx!.profileId, p.data.message],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

ticketsRouter.patch('/:id/close', async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `update public.support_tickets set status = 'closed' where id = $1 and school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.json({ ok: true });
});
