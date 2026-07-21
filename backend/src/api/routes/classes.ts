import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from '@neondatabase/serverless';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const classesRouter = Router();

const classSchema = z.object({
  name: z.string().min(1),
  year: z.number().int().min(2020).max(2100),
  level: z.string().optional(),
  shift: z.enum(['morning', 'afternoon', 'night', 'full']),
  teacher_id: z.string().uuid().optional(),
  subject_ids: z.array(z.string().uuid()).optional(),
});

classesRouter.use(requireAuth);

/** Regrava as matérias da turma (valida que pertencem à escola). */
async function saveClassSubjects(c: PoolClient, schoolId: string, classId: string, subjectIds?: string[]) {
  if (!subjectIds) return; // undefined = não mexe nas matérias
  await c.query('delete from public.class_subjects where class_id=$1 and school_id=$2', [classId, schoolId]);
  for (const sid of subjectIds) {
    await c.query(
      `insert into public.class_subjects (school_id, class_id, subject_id)
       select $1,$2,$3 where exists (select 1 from public.subjects where id=$3 and school_id=$1)
       on conflict (class_id, subject_id) do nothing`,
      [schoolId, classId, sid],
    );
  }
}

const CLASS_SELECT = `
  select c.id, c.name, c.year, c.level, c.shift, c.status, c.created_at,
         t.name as teacher_name,
         (select count(*)::int from public.students s where s.class_id = c.id and s.status = 'active') as student_count,
         coalesce((select array_agg(cs.subject_id) from public.class_subjects cs where cs.class_id = c.id), '{}') as subject_ids
    from public.classes c
    left join public.teachers t on t.id = c.teacher_id`;

const STAFF = ['school_admin', 'financial', 'teacher', 'superadmin'] as const;

classesRouter.get('/', requireRole(...STAFF), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(`${CLASS_SELECT} where c.school_id = $1 order by c.name asc`, [req.ctx!.schoolId]);
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /api/classes/:id/students — alunos da turma.
classesRouter.get('/:id/students', requireRole(...STAFF), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select s.id, s.name, s.registration_number, s.status
         from public.students s
        where s.class_id = $1 and s.school_id = $2
        order by s.name asc`,
      [req.params.id, req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /api/classes/:id/subjects — matérias da turma (para chamada/notas).
classesRouter.get('/:id/subjects', requireRole(...STAFF), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select sub.id, sub.name
         from public.class_subjects cs
         join public.subjects sub on sub.id = cs.subject_id
        where cs.class_id = $1 and cs.school_id = $2
        order by sub.name asc`,
      [req.params.id, req.ctx!.schoolId],
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
       returning id`,
      [req.ctx!.schoolId, d.name, d.year, d.level ?? null, d.shift, d.teacher_id ?? null],
    );
    const id = rows[0].id;
    await saveClassSubjects(c, req.ctx!.schoolId!, id, d.subject_ids);
    const { rows: full } = await c.query(`${CLASS_SELECT} where c.id = $1 and c.school_id = $2`, [id, req.ctx!.schoolId]);
    return full[0];
  });
  res.status(201).json({ ok: true, data: created });
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
      [d.name, d.year, d.level ?? null, d.shift, d.teacher_id ?? null, req.params.id, req.ctx!.schoolId],
    );
    await saveClassSubjects(c, req.ctx!.schoolId!, req.params.id, d.subject_ids);
    const { rows } = await c.query(`${CLASS_SELECT} where c.id = $1 and c.school_id = $2`, [req.params.id, req.ctx!.schoolId]);
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
