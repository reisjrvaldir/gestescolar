import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const gradesRouter = Router();

const batchSchema = z.object({
  class_id: z.string().uuid(),
  subject: z.string().min(1),
  period: z.string().min(1),
  grades: z.array(z.object({
    student_id: z.string().uuid(),
    grade: z.number().min(0).max(10),
  })).max(500),
});

gradesRouter.use(requireAuth);

gradesRouter.get('/', async (req, res) => {
  const { class_id, subject, period } = req.query;
  if (!class_id || !subject || !period) {
    return res.status(400).json({ code: 'validation', message: 'class_id, subject e period são obrigatórios' });
  }
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select g.id, g.student_id, g.grade::float8 as grade, g.subject, s.name as student_name
         from public.grades g
         join public.students s on s.id = g.student_id
        where g.school_id = $1 and g.class_id = $2 and g.period = $3
          and g.subject = $4
          and exists (select 1 from public.classes cl where cl.id = $2 and cl.school_id = $1)
        order by s.name asc`,
      [req.ctx!.schoolId, class_id, period, subject],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

gradesRouter.post('/batch', requireRole('school_admin', 'teacher', 'superadmin'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  }
  const { class_id, subject, period, grades } = parsed.data;
  const result = await withTenant(req.ctx!, async (c) => {
    // Turma e alunos precisam pertencer à escola (RLS inerte → sem estas
    // checagens seria possível gravar/ler nome de aluno de outra escola).
    const cls = await c.query(
      `select 1 from public.classes where id=$1 and school_id=$2 limit 1`,
      [class_id, req.ctx!.schoolId],
    );
    if (cls.rows.length === 0) return { error: 'class_not_found' as const };

    const ids = [...new Set(grades.map((g) => g.student_id))];
    if (ids.length > 0) {
      const valid = await c.query(
        `select count(*)::int as n from public.students where school_id=$1 and id = any($2::uuid[])`,
        [req.ctx!.schoolId, ids],
      );
      if (valid.rows[0].n !== ids.length) return { error: 'invalid_students' as const };
    }

    await c.query(
      `delete from public.grades
        where school_id = $1 and class_id = $2 and period = $3 and subject = $4`,
      [req.ctx!.schoolId, class_id, period, subject],
    );
    for (const g of grades) {
      await c.query(
        `insert into public.grades (school_id, student_id, class_id, period, grade, subject)
         values ($1, $2, $3, $4, $5, $6)`,
        [req.ctx!.schoolId, g.student_id, class_id, period, g.grade, subject],
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
