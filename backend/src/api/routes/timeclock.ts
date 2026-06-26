import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';

export const timeclockRouter = Router();
timeclockRouter.use(requireAuth);

timeclockRouter.get('/', async (req, res) => {
  const month = req.query.month as string | undefined; // YYYY-MM
  const data = await withTenant(req.ctx!, async (c) => {
    const params: unknown[] = [req.ctx!.schoolId, req.ctx!.profileId];
    let filter = '';
    if (month) {
      filter = ` and to_char(clock_in, 'YYYY-MM') = $3`;
      params.push(month);
    }
    const { rows } = await c.query(
      `select id, clock_in, clock_out, notes, created_at
         from public.timeclock_entries
        where school_id = $1 and user_id = $2${filter}
        order by clock_in desc`,
      params,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

timeclockRouter.get('/all', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    if (!['school_admin', 'superadmin'].includes(req.ctx!.role)) {
      return [];
    }
    const { rows } = await c.query(
      `select t.id, t.clock_in, t.clock_out, t.notes, p.name as user_name
         from public.timeclock_entries t
         join public.profiles p on p.id = t.user_id
        where t.school_id = $1
          and t.clock_in >= date_trunc('month', now())
        order by t.clock_in desc`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

timeclockRouter.post('/clock-in', async (req, res) => {
  const created = await withTenant(req.ctx!, async (c) => {
    const open = await c.query(
      `select id from public.timeclock_entries
        where school_id=$1 and user_id=$2 and clock_out is null limit 1`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
    if (open.rows.length > 0) return { error: 'already_clocked_in' as const };
    const { rows } = await c.query(
      `insert into public.timeclock_entries (school_id, user_id)
       values ($1, $2) returning id, clock_in`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
    return rows[0];
  });
  if ('error' in created) return res.status(409).json({ code: created.error });
  res.status(201).json({ ok: true, data: created });
});

timeclockRouter.post('/clock-out', async (req, res) => {
  const updated = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `update public.timeclock_entries set clock_out = now()
        where school_id=$1 and user_id=$2 and clock_out is null
        returning id, clock_in, clock_out`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
    if (rows.length === 0) return { error: 'not_clocked_in' as const };
    return rows[0];
  });
  if ('error' in updated) return res.status(409).json({ code: updated.error });
  res.json({ ok: true, data: updated });
});
