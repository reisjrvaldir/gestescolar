import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

const messageSchema = z.object({
  recipient_id: z.string().uuid(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  student_id: z.string().uuid().optional(),
});

// GET /api/messages — inbox (mensagens recebidas)
messagesRouter.get('/', async (req, res) => {
  const box = (req.query.box as string) ?? 'inbox';
  const data = await withTenant(req.ctx!, async (c) => {
    const field = box === 'sent' ? 'sender_id' : 'recipient_id';
    const { rows } = await c.query(
      `select m.id, m.subject, m.body, m.created_at, m.read_at, m.student_id,
              sender.name as sender_name, recipient.name as recipient_name,
              st.name as student_name
         from public.messages m
         join public.profiles sender on sender.id = m.sender_id
         join public.profiles recipient on recipient.id = m.recipient_id
         left join public.students st on st.id = m.student_id
        where m.${field} = $1 and m.school_id = $2
        order by m.created_at desc
        limit 100`,
      [req.ctx!.profileId, req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /api/messages/contacts — lista pessoas para destinar mensagem
messagesRouter.get('/contacts', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, name, role, email from public.profiles
        where school_id = $1 and status = 'active' and id != $2
        order by name`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

messagesRouter.post('/', async (req, res) => {
  const p = messageSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.messages (school_id, sender_id, recipient_id, student_id, subject, body)
       values ($1,$2,$3,$4,$5,$6)
       returning id, subject, body, created_at`,
      [req.ctx!.schoolId, req.ctx!.profileId, p.data.recipient_id,
       p.data.student_id ?? null, p.data.subject, p.data.body],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

messagesRouter.patch('/:id/read', async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `update public.messages set read_at = now()
        where id=$1 and recipient_id=$2 and read_at is null`,
      [req.params.id, req.ctx!.profileId],
    );
  });
  res.status(204).end();
});
