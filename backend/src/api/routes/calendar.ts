import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { dateSchema } from '../../lib/validation';

export const calendarRouter = Router();
calendarRouter.use(requireAuth);

calendarRouter.get('/', async (req, res) => {
  const year = req.query.year as string | undefined;
  const data = await withTenant(req.ctx!, async (c) => {
    const params: unknown[] = [req.ctx!.schoolId];
    let filter = '';
    if (year) {
      filter = ' and extract(year from date_start) = $2';
      params.push(Number(year));
    }
    const { rows } = await c.query(
      `select id, title, description, date_start, date_end, event_type,
              to_char(start_time, 'HH24:MI') as start_time,
              to_char(end_time,   'HH24:MI') as end_time,
              created_at
         from public.school_calendar
        where school_id = $1${filter}
        order by date_start asc, start_time asc nulls last`,
      params,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido');
const eventSchema = z.object({
  title: z.string().min(2, 'Informe o título'),
  description: z.string().optional(),
  date_start: dateSchema,
  date_end: dateSchema.optional(),
  event_type: z.enum(['holiday', 'exam', 'meeting', 'event', 'recess']).optional(),
  start_time: timeSchema.optional(),
  end_time: timeSchema.optional(),
});

calendarRouter.post('/', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const p = eventSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.school_calendar (school_id, title, description, date_start, date_end, event_type, start_time, end_time)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, title, date_start, event_type`,
      [req.ctx!.schoolId, p.data.title, p.data.description ?? null,
       p.data.date_start, p.data.date_end ?? null, p.data.event_type ?? 'event',
       p.data.start_time ?? null, p.data.end_time ?? null],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

calendarRouter.delete('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `delete from public.school_calendar where id = $1 and school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.status(204).end();
});
