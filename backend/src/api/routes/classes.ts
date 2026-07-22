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
  // subject_ids: formato antigo (só matérias). subjects: novo formato com
  // professor por matéria (permite vários professores na mesma turma).
  subject_ids: z.array(z.string().uuid()).optional(),
  subjects: z.array(z.object({
    subject_id: z.string().uuid(),
    teacher_id: z.string().uuid().optional().nullable(),
  })).optional(),
});

classesRouter.use(requireAuth);

/** Regrava as matérias da turma + o professor de cada matéria (valida escola). */
async function saveClassSubjects(
  c: PoolClient, schoolId: string, classId: string,
  items?: { subject_id: string; teacher_id?: string | null }[],
) {
  if (!items) return; // undefined = não mexe nas matérias
  await c.query('delete from public.class_subjects where class_id=$1 and school_id=$2', [classId, schoolId]);
  for (const it of items) {
    await c.query(
      `insert into public.class_subjects (school_id, class_id, subject_id, teacher_id)
       select $1, $2, $3, (select id from public.teachers where id=$4 and school_id=$1)
        where exists (select 1 from public.subjects where id=$3 and school_id=$1)
       on conflict (class_id, subject_id) do update set teacher_id = excluded.teacher_id`,
      [schoolId, classId, it.subject_id, it.teacher_id ?? null],
    );
  }
}

/** Normaliza o corpo: usa `subjects` (novo) ou converte `subject_ids` (antigo). */
function subjectItems(d: { subjects?: { subject_id: string; teacher_id?: string | null }[]; subject_ids?: string[] }) {
  if (d.subjects) return d.subjects;
  if (d.subject_ids) return d.subject_ids.map((id) => ({ subject_id: id, teacher_id: null }));
  return undefined;
}

const CLASS_SELECT = `
  select c.id, c.name, c.year, c.level, c.shift, c.status, c.created_at, c.teacher_id,
         t.name as teacher_name,
         (select count(*)::int from public.students s where s.class_id = c.id and s.status = 'active') as student_count,
         coalesce((select array_agg(cs.subject_id) from public.class_subjects cs where cs.class_id = c.id), '{}') as subject_ids,
         coalesce((
           select json_agg(json_build_object(
             'subject_id', cs.subject_id, 'subject_name', sub.name,
             'teacher_id', cs.teacher_id, 'teacher_name', tt.name))
           from public.class_subjects cs
           left join public.subjects sub on sub.id = cs.subject_id
           left join public.teachers tt on tt.id = cs.teacher_id
          where cs.class_id = c.id
         ), '[]'::json) as subjects
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

// GET /api/classes/mine — turmas do professor logado (onde ele é o regente).
classesRouter.get('/mine', requireRole('teacher', 'coordinator', 'school_admin', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const t = await c.query(
      `select id from public.teachers where user_id=$1 and school_id=$2 limit 1`,
      [req.ctx!.profileId, req.ctx!.schoolId],
    );
    if (t.rows.length === 0) return [];
    // Turma onde é regente OU leciona alguma matéria (professor por matéria).
    const { rows } = await c.query(
      `${CLASS_SELECT} where c.school_id = $1 and c.status = 'active'
         and (c.teacher_id = $2
              or exists (select 1 from public.class_subjects cs
                          where cs.class_id = c.id and cs.teacher_id = $2))
        order by c.name asc`,
      [req.ctx!.schoolId, t.rows[0].id],
    );
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
    await saveClassSubjects(c, req.ctx!.schoolId!, id, subjectItems(d));
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
    await saveClassSubjects(c, req.ctx!.schoolId!, req.params.id, subjectItems(d));
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
