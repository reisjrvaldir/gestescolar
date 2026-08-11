import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// GET /api/notifications — as 30 mais recentes do usuário logado.
notificationsRouter.get('/', async (req, res) => {
  try {
    const data = await withTenant(req.ctx!, async (c) => {
      const { rows } = await c.query(
        `select id, type, title, body, link, entity_type, entity_id, read_at, created_at
           from public.notifications
          where school_id = $1 and profile_id = $2
          order by created_at desc
          limit 30`,
        [req.ctx!.schoolId, req.ctx!.profileId],
      );
      return rows;
    });
    res.json({ ok: true, data });
  } catch (err: any) {
    console.error('[notifications.list] erro:', err?.message ?? err);
    res.status(500).json({ code: 'notifications_load_failed', message: 'Não foi possível carregar as notificações.' });
  }
});

// GET /api/notifications/unread-count — badge do sino.
notificationsRouter.get('/unread-count', async (req, res) => {
  try {
    const count = await withTenant(req.ctx!, async (c) => {
      const { rows } = await c.query(
        `select count(*)::int as count from public.notifications
          where school_id = $1 and profile_id = $2 and read_at is null`,
        [req.ctx!.schoolId, req.ctx!.profileId],
      );
      return rows[0]?.count ?? 0;
    });
    res.json({ ok: true, data: { count } });
  } catch (err: any) {
    console.error('[notifications.unreadCount] erro:', err?.message ?? err);
    res.status(500).json({ code: 'unread_count_failed', message: 'Não foi possível contar notificações.' });
  }
});

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', async (req, res) => {
  try {
    await withTenant(req.ctx!, async (c) => {
      await c.query(
        `update public.notifications set read_at = now()
          where id = $1 and school_id = $2 and profile_id = $3 and read_at is null`,
        [req.params.id, req.ctx!.schoolId, req.ctx!.profileId],
      );
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[notifications.markRead] erro:', err?.message ?? err);
    res.status(500).json({ code: 'mark_read_failed', message: 'Não foi possível marcar como lida.' });
  }
});

// PATCH /api/notifications/read-all
notificationsRouter.patch('/read-all', async (req, res) => {
  try {
    await withTenant(req.ctx!, async (c) => {
      await c.query(
        `update public.notifications set read_at = now()
          where school_id = $1 and profile_id = $2 and read_at is null`,
        [req.ctx!.schoolId, req.ctx!.profileId],
      );
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[notifications.markAllRead] erro:', err?.message ?? err);
    res.status(500).json({ code: 'mark_all_read_failed', message: 'Não foi possível marcar todas como lidas.' });
  }
});
