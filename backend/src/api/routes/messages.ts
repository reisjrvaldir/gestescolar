import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../lib/audit';

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

const messageSchema = z.object({
  recipient_id: z.string().uuid(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  student_id: z.string().uuid().optional(),
});

// GET /api/messages/threads — lista de conversas agrupadas por parceiro
messagesRouter.get('/threads', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `WITH partners AS (
         SELECT
           CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS partner_id,
           MAX(created_at) AS last_at
         FROM public.messages
         WHERE school_id = $2 AND (sender_id = $1 OR recipient_id = $1)
         GROUP BY partner_id
       ),
       last_msg AS (
         SELECT DISTINCT ON (
           CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END
         )
           CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS partner_id,
           body, subject, created_at, sender_id
         FROM public.messages
         WHERE school_id = $2 AND (sender_id = $1 OR recipient_id = $1)
         ORDER BY partner_id, created_at DESC
       )
       SELECT
         p.partner_id,
         pr.name AS partner_name,
         pr.role AS partner_role,
         lm.body AS last_body,
         lm.subject AS last_subject,
         lm.sender_id = $1 AS is_mine,
         p.last_at,
         (
           SELECT COUNT(*)::int FROM public.messages
           WHERE school_id = $2 AND recipient_id = $1 AND sender_id = p.partner_id AND read_at IS NULL
         ) AS unread_count
       FROM partners p
       JOIN public.profiles pr ON pr.id = p.partner_id
       JOIN last_msg lm ON lm.partner_id = p.partner_id
       ORDER BY p.last_at DESC`,
      [req.ctx!.profileId, req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /api/messages/unread-count — total de mensagens não lidas do usuário
// (badge no menu lateral). Não bloqueia a UI: se falhar, o front trata como 0.
messagesRouter.get('/unread-count', async (req, res) => {
  try {
    const count = await withTenant(req.ctx!, async (c) => {
      const { rows } = await c.query(
        `select count(*)::int as count from public.messages
          where school_id = $1 and recipient_id = $2 and read_at is null`,
        [req.ctx!.schoolId, req.ctx!.profileId],
      );
      return rows[0]?.count ?? 0;
    });
    res.json({ ok: true, data: { count } });
  } catch (err: any) {
    console.error('[messages.unreadCount] erro:', err?.message ?? err);
    res.status(500).json({ code: 'unread_count_failed', message: 'Não foi possível contar mensagens não lidas.' });
  }
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

// GET /api/messages/thread/:partnerId — todas as mensagens com um parceiro
messagesRouter.get('/thread/:partnerId', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `SELECT m.id, m.subject, m.body, m.created_at, m.read_at,
              m.sender_id, m.recipient_id,
              sender.name AS sender_name, recipient.name AS recipient_name
         FROM public.messages m
         JOIN public.profiles sender ON sender.id = m.sender_id
         JOIN public.profiles recipient ON recipient.id = m.recipient_id
        WHERE m.school_id = $1
          AND (
            (m.sender_id = $2 AND m.recipient_id = $3)
            OR (m.recipient_id = $2 AND m.sender_id = $3)
          )
        ORDER BY m.created_at ASC`,
      [req.ctx!.schoolId, req.ctx!.profileId, req.params.partnerId],
    );
    await c.query(
      `UPDATE public.messages SET read_at = now()
        WHERE school_id = $1 AND recipient_id = $2 AND sender_id = $3 AND read_at IS NULL`,
      [req.ctx!.schoolId, req.ctx!.profileId, req.params.partnerId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /api/messages — inbox/sent legado (mantido para compatibilidade)
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

// POST /api/messages — enviar mensagem individual
messagesRouter.post('/', async (req, res) => {
  const p = messageSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const result = await withTenant(req.ctx!, async (c) => {
    const recip = await c.query(
      `select 1 from public.profiles where id=$1 and school_id=$2 and status='active' limit 1`,
      [p.data.recipient_id, req.ctx!.schoolId],
    );
    if (recip.rows.length === 0) return { error: 'invalid_recipient' as const };

    if (p.data.student_id) {
      const stu = await c.query(
        `select 1 from public.students where id=$1 and school_id=$2 limit 1`,
        [p.data.student_id, req.ctx!.schoolId],
      );
      if (stu.rows.length === 0) return { error: 'invalid_student' as const };
    }

    const { rows } = await c.query(
      `insert into public.messages (school_id, sender_id, recipient_id, student_id, subject, body)
       values ($1,$2,$3,$4,$5,$6)
       returning id, subject, body, created_at`,
      [req.ctx!.schoolId, req.ctx!.profileId, p.data.recipient_id,
       p.data.student_id ?? null, p.data.subject, p.data.body],
    );
    await audit(c, {
      schoolId: req.ctx!.schoolId!, userId: req.ctx!.profileId, action: 'MESSAGE_SENT',
      entityType: 'message', entityId: rows[0].id,
      metadata: { recipient_id: p.data.recipient_id, subject: p.data.subject },
    });
    return { data: rows[0] };
  });

  if ('error' in result) {
    const message = result.error === 'invalid_recipient'
      ? 'Destinatário inválido para esta escola.'
      : 'Aluno inválido para esta escola.';
    return res.status(400).json({ code: result.error, message });
  }
  res.status(201).json({ ok: true, data: result.data });
});

// POST /api/messages/broadcast — enviar para uma turma ou todos os responsáveis
const broadcastSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  class_id: z.string().uuid().optional(),
});

messagesRouter.post('/broadcast', async (req, res) => {
  const { role, profileId, schoolId } = req.ctx!;
  if (!['school_admin', 'teacher', 'superadmin'].includes(role)) {
    return res.status(403).json({ code: 'forbidden', message: 'Permissão insuficiente' });
  }

  const p = broadcastSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });

  const result = await withTenant(req.ctx!, async (c) => {
    let guardianRows: { profile_id: string }[];

    if (p.data.class_id) {
      // Confirma que a turma é desta escola ANTES de usar o id em qualquer
      // outra query — sem isso, um class_id de outra escola só devolveria 0
      // destinatários hoje (não vaza mensagem), mas depender dessa
      // coincidência não é o padrão que este projeto quer manter.
      const cls = await c.query(`select 1 from public.classes where id=$1 and school_id=$2`, [p.data.class_id, schoolId]);
      if (cls.rows.length === 0) return 'invalid_class' as const;

      const { rows } = await c.query(
        `SELECT DISTINCT g.user_id AS profile_id
           FROM public.guardians g
           JOIN public.students s ON s.guardian_id = g.id
          WHERE g.school_id = $1 AND s.class_id = $2 AND g.user_id IS NOT NULL`,
        [schoolId, p.data.class_id],
      );
      guardianRows = rows;
    } else {
      const { rows } = await c.query(
        `SELECT DISTINCT user_id AS profile_id
           FROM public.guardians
          WHERE school_id = $1 AND user_id IS NOT NULL`,
        [schoolId],
      );
      guardianRows = rows;
    }

    let sent = 0;
    for (const g of guardianRows) {
      if (g.profile_id !== profileId) {
        await c.query(
          `INSERT INTO public.messages (school_id, sender_id, recipient_id, subject, body)
           VALUES ($1, $2, $3, $4, $5)`,
          [schoolId, profileId, g.profile_id, p.data.subject, p.data.body],
        );
        sent++;
      }
    }
    await audit(c, {
      schoolId: schoolId!, userId: profileId, action: 'MESSAGE_BROADCAST',
      entityType: 'message_broadcast',
      metadata: { subject: p.data.subject, class_id: p.data.class_id ?? null, sent },
    });
    return sent;
  });

  if (result === 'invalid_class') {
    return res.status(400).json({ code: 'invalid_class', message: 'Turma não encontrada nesta escola.' });
  }
  res.status(201).json({ ok: true, sent: result });
});

messagesRouter.patch('/:id/read', async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    // school_id explícito aqui por padrão/consistência com o resto do arquivo
    // (não por vazamento real: recipient_id já restringe a mensagens do
    // próprio usuário, que só pode pertencer a uma escola).
    await c.query(
      `update public.messages set read_at = now()
        where id=$1 and recipient_id=$2 and school_id=$3 and read_at is null`,
      [req.params.id, req.ctx!.profileId, req.ctx!.schoolId],
    );
  });
  res.status(204).end();
});
