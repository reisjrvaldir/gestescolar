import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { dateSchema } from '../../lib/validation';

export const calendarRouter = Router();
calendarRouter.use(requireAuth);

calendarRouter.get('/', async (req, res) => {
  const year = req.query.year as string | undefined;
  const { role, profileId, schoolId } = req.ctx!;

  const data = await withTenant(req.ctx!, async (c) => {
    const params: unknown[] = [schoolId];
    let yearFilter = '';
    if (year) {
      yearFilter = ' and extract(year from sc.date_start) = $2';
      params.push(Number(year));
    }

    let classFilter = '';
    if (role === 'teacher') {
      params.push(profileId);
      classFilter = ` and (sc.class_id IS NULL OR sc.class_id IN (
        SELECT cs.class_id FROM public.class_subjects cs
        JOIN public.teachers t ON t.id = cs.teacher_id
        WHERE t.user_id = $${params.length} AND cs.school_id = $1
      ))`;
    } else if (role === 'guardian') {
      params.push(profileId);
      classFilter = ` and (sc.class_id IS NULL OR sc.class_id IN (
        SELECT s.class_id FROM public.students s
        JOIN public.guardians g ON g.id = s.guardian_id
        WHERE g.user_id = $${params.length} AND g.school_id = $1 AND s.class_id IS NOT NULL
      ))`;
    }

    const { rows } = await c.query(
      `select sc.id, sc.title, sc.description,
              to_char(sc.date_start, 'YYYY-MM-DD') as date_start,
              to_char(sc.date_end,   'YYYY-MM-DD') as date_end,
              sc.event_type,
              sc.class_id, cl.name as class_name,
              to_char(sc.start_time, 'HH24:MI') as start_time,
              to_char(sc.end_time,   'HH24:MI') as end_time,
              sc.created_at
         from public.school_calendar sc
         left join public.classes cl ON cl.id = sc.class_id
        where sc.school_id = $1${yearFilter}${classFilter}
        order by sc.date_start asc, sc.start_time asc nulls last`,
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
  class_id: z.string().uuid().optional(),
});

calendarRouter.post('/', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const p = eventSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.school_calendar
         (school_id, title, description, date_start, date_end, event_type, start_time, end_time, class_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, title, to_char(date_start, 'YYYY-MM-DD') as date_start, event_type, class_id`,
      [req.ctx!.schoolId, p.data.title, p.data.description ?? null,
       p.data.date_start, p.data.date_end ?? null, p.data.event_type ?? 'event',
       p.data.start_time ?? null, p.data.end_time ?? null, p.data.class_id ?? null],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

calendarRouter.put('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const p = eventSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const updated = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `update public.school_calendar set
          title=$1, description=$2, date_start=$3, date_end=$4,
          event_type=$5, start_time=$6, end_time=$7, class_id=$8
        where id=$9 and school_id=$10
        returning id, title, to_char(date_start,'YYYY-MM-DD') as date_start,
                  to_char(date_end,'YYYY-MM-DD') as date_end,
                  event_type, class_id,
                  to_char(start_time,'HH24:MI') as start_time,
                  to_char(end_time,'HH24:MI') as end_time`,
      [p.data.title, p.data.description ?? null,
       p.data.date_start, p.data.date_end ?? null, p.data.event_type ?? 'event',
       p.data.start_time ?? null, p.data.end_time ?? null, p.data.class_id ?? null,
       req.params.id, req.ctx!.schoolId],
    );
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found' });
  res.json({ ok: true, data: updated });
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
