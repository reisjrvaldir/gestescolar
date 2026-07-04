import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const attendanceRouter = Router();

const batchSchema = z.object({
  class_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(z.object({
    student_id: z.string().uuid(),
    status: z.enum(['present', 'absent', 'justified']),
    justification: z.string().optional(),
  })).max(500),
});

attendanceRouter.use(requireAuth);

attendanceRouter.get('/', async (req, res) => {
  const { class_id, date } = req.query;
  if (!class_id || !date) {
    return res.status(400).json({ code: 'validation', message: 'class_id e date são obrigatórios' });
  }
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select a.id, a.student_id, a.status, a.justification, s.name as student_name
         from public.attendance a
         join public.students s on s.id = a.student_id
        where a.school_id = $1 and a.class_id = $2 and a.date = $3
          and exists (select 1 from public.classes cl where cl.id = $2 and cl.school_id = $1)
        order by s.name asc`,
      [req.ctx!.schoolId, class_id, date],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

attendanceRouter.post('/batch', requireRole('school_admin', 'teacher', 'superadmin'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  }
  const { class_id, date, entries } = parsed.data;
  const result = await withTenant(req.ctx!, async (c) => {
    // Turma e alunos precisam pertencer à escola (RLS inerte → defesa na app).
    const cls = await c.query(
      `select 1 from public.classes where id=$1 and school_id=$2 limit 1`,
      [class_id, req.ctx!.schoolId],
    );
    if (cls.rows.length === 0) return { error: 'class_not_found' as const };

    const ids = [...new Set(entries.map((e) => e.student_id))];
    if (ids.length > 0) {
      const valid = await c.query(
        `select count(*)::int as n from public.students where school_id=$1 and id = any($2::uuid[])`,
        [req.ctx!.schoolId, ids],
      );
      if (valid.rows[0].n !== ids.length) return { error: 'invalid_students' as const };
    }

    await c.query(
      `delete from public.attendance
        where school_id = $1 and class_id = $2 and date = $3`,
      [req.ctx!.schoolId, class_id, date],
    );
    const teacherRow = await c.query(
      `select t.id from public.teachers t where t.user_id = $1 and t.school_id = $2 limit 1`,
      [req.ctx!.profileId, req.ctx!.schoolId],
    );
    const teacherId = teacherRow.rows[0]?.id ?? null;
    for (const e of entries) {
      await c.query(
        `insert into public.attendance (school_id, student_id, class_id, teacher_id, date, status, justification)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [req.ctx!.schoolId, e.student_id, class_id, teacherId, date, e.status, e.justification ?? null],
      );
    }
    return { ok: true as const };
  });
  if ('error' in result) {
    const msg = result.error === 'class_not_found' ? 'Turma não encontrada nesta escola.' : 'Aluno inválido para esta escola.';
    return res.status(result.error === 'class_not_found' ? 404 : 400).json({ code: result.error, message: msg });
  }
  res.json({ ok: true });
});
