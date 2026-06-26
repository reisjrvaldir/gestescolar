import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const classesRouter = Router();

const classSchema = z.object({
  name: z.string().min(1),
  year: z.number().int().min(2020).max(2100),
  level: z.string().optional(),
  shift: z.enum(['morning', 'afternoon', 'night', 'full']),
  teacher_id: z.string().uuid().optional(),
});

classesRouter.use(requireAuth);

classesRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select c.id, c.name, c.year, c.level, c.shift, c.status, c.created_at,
              t.name as teacher_name,
              (select count(*)::int from public.students s where s.class_id = c.id and s.status = 'active') as student_count
         from public.classes c
         left join public.teachers t on t.id = c.teacher_id
        where c.school_id = $1
        order by c.name asc`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

classesRouter.post('/', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const parsed = classSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  }
  const d = parsed.data;
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.classes (school_id, name, year, level, shift, teacher_id)
       values ($1, $2, $3, $4, $5, $6)
       returning id, name, year, level, shift, status, created_at`,
      [req.ctx!.schoolId, d.name, d.year, d.level ?? null, d.shift, d.teacher_id ?? null],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: { ...created, teacher_name: null, student_count: 0 } });
});

classesRouter.put('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const parsed = classSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  }
  const d = parsed.data;
  const updated = await withTenant(req.ctx!, async (c) => {
    await c.query(
      `update public.classes set name=$1, year=$2, level=$3, shift=$4, teacher_id=$5
        where id=$6 and school_id=$7`,
      [d.name, d.year, d.level ?? null, d.shift, d.teacher_id ?? null,
       req.params.id, req.ctx!.schoolId],
    );
    const { rows } = await c.query(
      `select c.id, c.name, c.year, c.level, c.shift, c.status, c.created_at,
              t.name as teacher_name,
              (select count(*)::int from public.students s where s.class_id = c.id and s.status = 'active') as student_count
         from public.classes c
         left join public.teachers t on t.id = c.teacher_id
        where c.id = $1 and c.school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found' });
  res.json({ ok: true, data: updated });
});

classesRouter.delete('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `update public.classes set status = 'inactive' where id = $1 and school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.status(204).end();
});
