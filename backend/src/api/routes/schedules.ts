import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const schedulesRouter = Router();
schedulesRouter.use(requireAuth);

schedulesRouter.get('/', requireRole('school_admin', 'financial', 'teacher', 'superadmin'), async (req, res) => {
  const userId = req.query.user_id as string | undefined;
  const data = await withTenant(req.ctx!, async (c) => {
    const params: unknown[] = [req.ctx!.schoolId];
    let filter = '';
    if (userId) {
      filter = ' and ws.user_id = $2';
      params.push(userId);
    }
    const { rows } = await c.query(
      `select ws.id, ws.user_id, ws.weekday, ws.start_time, ws.end_time, p.name as user_name
         from public.work_schedules ws
         join public.profiles p on p.id = ws.user_id
        where ws.school_id = $1${filter}
        order by p.name, ws.weekday`,
      params,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

const scheduleSchema = z.object({
  user_id: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
});

schedulesRouter.post('/', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const p = scheduleSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.work_schedules (school_id, user_id, weekday, start_time, end_time)
       values ($1, $2, $3, $4, $5)
       on conflict (school_id, user_id, weekday) do update set start_time=$4, end_time=$5
       returning id, weekday, start_time, end_time`,
      [req.ctx!.schoolId, p.data.user_id, p.data.weekday, p.data.start_time, p.data.end_time],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

schedulesRouter.delete('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `delete from public.work_schedules where id = $1 and school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.status(204).end();
});
