import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const gradesRouter = Router();

gradesRouter.use(requireAuth);

// GET /grades/settings → nota mínima de aprovação da escola
gradesRouter.get('/settings', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select passing_grade::float8, final_passing_grade::float8
         from public.school_grade_settings where school_id=$1`,
      [req.ctx!.schoolId],
    );
    return rows[0] ?? { passing_grade: 7.0, final_passing_grade: 5.0 };
  });
  res.json({ ok: true, data });
});

// PUT /grades/settings → gestão configura nota mínima
gradesRouter.put('/settings', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const parsed = z.object({
    passing_grade:       z.number().min(0).max(10),
    final_passing_grade: z.number().min(0).max(10),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `insert into public.school_grade_settings (school_id, passing_grade, final_passing_grade)
       values ($1,$2,$3)
       on conflict (school_id) do update
         set passing_grade=$2, final_passing_grade=$3, updated_at=now()`,
      [req.ctx!.schoolId, parsed.data.passing_grade, parsed.data.final_passing_grade],
    );
  });
  res.json({ ok: true });
});

// GET /grades?class_id=&subject=&period= → pivot AV1/AV2/Final por aluno
gradesRouter.get('/', async (req, res) => {
  const { class_id, subject, period } = req.query;
  if (!class_id || !subject || !period) {
    return res.status(400).json({ code: 'validation', message: 'class_id, subject e period são obrigatórios' });
  }
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select g.student_id,
              s.name as student_name,
              s.registration_number,
              max(case when g.assessment_type='av1'   then g.grade end)::float8 as av1,
              max(case when g.assessment_type='av2'   then g.grade end)::float8 as av2,
              max(case when g.assessment_type='final' then g.grade end)::float8 as final_grade
         from public.grades g
         join public.students s on s.id = g.student_id
        where g.school_id=$1 and g.class_id=$2 and g.period=$3 and g.subject=$4
          and exists (select 1 from public.classes cl where cl.id=$2 and cl.school_id=$1)
        group by g.student_id, s.name, s.registration_number
        order by s.name`,
      [req.ctx!.schoolId, class_id, period, subject],
    );
    return rows;
  });
  const locked = data.some((r: any) => r.av1 !== null || r.av2 !== null);
  res.json({ ok: true, data, locked });
});

// GET /grades/boletim?class_id= → pivot completo (todos os períodos + matérias)
gradesRouter.get('/boletim', async (req, res) => {
  const { class_id } = req.query;
  if (!class_id) return res.status(400).json({ code: 'validation', message: 'class_id é obrigatório' });
  const result = await withTenant(req.ctx!, async (c) => {
    const students = await c.query(
      `select s.id, s.name, s.registration_number
         from public.students s where s.school_id=$1 and s.class_id=$2 order by s.name`,
      [req.ctx!.schoolId, class_id],
    );
    const grades = await c.query(
      `select g.student_id, g.subject, g.period, g.assessment_type, g.grade::float8 as grade
         from public.grades g where g.school_id=$1 and g.class_id=$2 order by g.period, g.subject`,
      [req.ctx!.schoolId, class_id],
    );
    return { students: students.rows, grades: grades.rows };
  });
  res.json({ ok: true, data: result });
});

// GET /grades/my-boletim → notas do(s) filho(s) do responsável autenticado
gradesRouter.get('/my-boletim', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const g = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [req.ctx!.profileId]);
    if (g.rows.length === 0) return { students: [], grades: [], settings: { passing_grade: 7, final_passing_grade: 5 } };
    const students = await c.query(
      `select s.id, s.name, s.registration_number, s.class_id, cl.name as class_name, cl.year as class_year
         from public.students s
         left join public.classes cl on cl.id = s.class_id
        where s.guardian_id = $1 and s.school_id = $2 and s.status = 'active' order by s.name`,
      [g.rows[0].id, req.ctx!.schoolId],
    );
    if (students.rows.length === 0) return { students: [], grades: [], settings: { passing_grade: 7, final_passing_grade: 5 } };
    const studentIds = students.rows.map((s: any) => s.id);
    const classIds = students.rows.map((s: any) => s.class_id).filter(Boolean);
    const grades = await c.query(
      `select g.student_id, g.subject, g.period, g.assessment_type, g.grade::float8 as grade
         from public.grades g
        where g.school_id = $1 and g.student_id = any($2::uuid[])
          and g.class_id = any($3::uuid[])
        order by g.subject, g.period`,
      [req.ctx!.schoolId, studentIds, classIds],
    );
    const settings = await c.query(
      `select passing_grade::float8, final_passing_grade::float8
         from public.school_grade_settings where school_id=$1`,
      [req.ctx!.schoolId],
    );
    const ranking = await c.query(
      `select g.student_id, avg(g.grade)::float8 as avg_grade, g.class_id
         from public.grades g
         join public.students s on s.id = g.student_id
        where g.school_id = $1 and g.class_id = any($2::uuid[])
        group by g.student_id, g.class_id
        order by avg_grade desc`,
      [req.ctx!.schoolId, classIds],
    );
    // Todas as matérias cadastradas nas turmas dos filhos (mesmo sem nota lançada).
    const classSubjects = classIds.length > 0
      ? await c.query(
          `select cs.class_id, sub.name as subject
             from public.class_subjects cs
             join public.subjects sub on sub.id = cs.subject_id
            where cs.school_id = $1 and cs.class_id = any($2::uuid[])
            order by sub.name`,
          [req.ctx!.schoolId, classIds],
        )
      : { rows: [] as any[] };
    return {
      students: students.rows,
      grades: grades.rows,
      settings: settings.rows[0] ?? { passing_grade: 7, final_passing_grade: 5 },
      ranking: ranking.rows,
      class_subjects: classSubjects.rows,
    };
  });
  res.json({ ok: true, data });
});

// GET /grades/summary?class_id=&period= → contagem por status e desempenho por disciplina
gradesRouter.get('/summary', async (req, res) => {
  const { class_id, period } = req.query;
  if (!class_id || !period) return res.status(400).json({ code: 'validation', message: 'class_id e period são obrigatórios' });
  const data = await withTenant(req.ctx!, async (c) => {
    const settings = await c.query(
      `select passing_grade::float8, final_passing_grade::float8
         from public.school_grade_settings where school_id=$1`,
      [req.ctx!.schoolId],
    );
    const pg  = settings.rows[0]?.passing_grade       ?? 7.0;
    const fpg = settings.rows[0]?.final_passing_grade ?? 5.0;

    const { rows } = await c.query(
      `select
          g.student_id, g.subject,
          max(case when g.assessment_type='av1'   then g.grade end)::float8 as av1,
          max(case when g.assessment_type='av2'   then g.grade end)::float8 as av2,
          max(case when g.assessment_type='final' then g.grade end)::float8 as final_grade
         from public.grades g
        where g.school_id=$1 and g.class_id=$2 and g.period=$3
        group by g.student_id, g.subject`,
      [req.ctx!.schoolId, class_id, period],
    );

    // Status por aluno (considera o pior status entre disciplinas)
    const studentStatus: Record<string, string> = {};
    const subjectMap: Record<string, { sum: number; approved: number; total: number }> = {};

    for (const r of rows) {
      const avg = (r.av1 + r.av2) / 2;
      let status = '';
      if (avg >= pg) status = 'approved';
      else if (r.final_grade !== null && r.final_grade >= fpg) status = 'approved_final';
      else if (r.final_grade !== null) status = 'failed';
      else status = 'recovery';

      // Pior status vence
      const RANK: Record<string, number> = { approved: 0, approved_final: 1, recovery: 2, failed: 3 };
      const prev = studentStatus[r.student_id];
      if (!prev || RANK[status] > RANK[prev]) studentStatus[r.student_id] = status;

      // Desempenho por disciplina
      if (!subjectMap[r.subject]) subjectMap[r.subject] = { sum: 0, approved: 0, total: 0 };
      const sm = subjectMap[r.subject];
      if (Number.isFinite(avg)) { sm.sum += avg; sm.total++; }
      if (status === 'approved' || status === 'approved_final') sm.approved++;
    }

    const statusCounts = { approved: 0, approved_final: 0, recovery: 0, failed: 0 };
    for (const s of Object.values(studentStatus)) (statusCounts as any)[s]++;

    const bySubject = Object.entries(subjectMap).map(([subject, sm]) => ({
      subject,
      avg: sm.total > 0 ? sm.sum / sm.total : 0,
      passing_rate: sm.total > 0 ? sm.approved / sm.total : 0,
      total: sm.total,
    })).sort((a, b) => b.avg - a.avg);

    return { statusCounts, bySubject, passingGrade: pg, finalPassingGrade: fpg };
  });
  res.json({ ok: true, data });
});

const batchSchema = z.object({
  class_id: z.string().uuid(),
  subject: z.string().min(1),
  period: z.string().min(1),
  entries: z.array(z.object({
    student_id: z.string().uuid(),
    av1:   z.number().min(0).max(10).optional(),
    av2:   z.number().min(0).max(10).optional(),
    final: z.number().min(0).max(10).optional(),
  })).max(500),
});

// POST /grades/batch → salva AV1/AV2 (teacher: lock se já existem) + Final (sempre liberado)
gradesRouter.post('/batch', requireRole('school_admin', 'teacher', 'superadmin'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  const { class_id, subject, period, entries } = parsed.data;

  const result = await withTenant(req.ctx!, async (c) => {
    const cls = await c.query(`select 1 from public.classes where id=$1 and school_id=$2 limit 1`, [class_id, req.ctx!.schoolId]);
    if (cls.rows.length === 0) return { error: 'class_not_found' as const };

    const ids = [...new Set(entries.map((e) => e.student_id))];
    if (ids.length > 0) {
      const valid = await c.query(
        `select count(*)::int as n from public.students where school_id=$1 and id=any($2::uuid[])`,
        [req.ctx!.schoolId, ids],
      );
      if (valid.rows[0].n !== ids.length) return { error: 'invalid_students' as const };
    }

    const hasFinalOnly = entries.every((e) => !e.av1 && !e.av2 && e.final !== undefined);

    // Professor não pode sobrescrever AV1/AV2 já lançados (pode lançar Final)
    if (req.ctx!.role === 'teacher' && !hasFinalOnly) {
      const existing = await c.query(
        `select 1 from public.grades where school_id=$1 and class_id=$2 and period=$3 and subject=$4
          and assessment_type in ('av1','av2') limit 1`,
        [req.ctx!.schoolId, class_id, period, subject],
      );
      if (existing.rows.length > 0) return { error: 'already_locked' as const };
    }

    // Delete e re-insert por tipo
    const typesToDelete: string[] = [];
    if (!hasFinalOnly) typesToDelete.push('av1', 'av2');
    if (entries.some((e) => e.final !== undefined)) typesToDelete.push('final');

    if (typesToDelete.length > 0) {
      await c.query(
        `delete from public.grades
          where school_id=$1 and class_id=$2 and period=$3 and subject=$4 and assessment_type=any($5::text[])`,
        [req.ctx!.schoolId, class_id, period, subject, typesToDelete],
      );
    }

    for (const e of entries) {
      for (const [type, val] of [['av1', e.av1], ['av2', e.av2], ['final', e.final]] as const) {
        if (val === undefined || !Number.isFinite(val)) continue;
        await c.query(
          `insert into public.grades (school_id, student_id, class_id, period, grade, subject, assessment_type)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [req.ctx!.schoolId, e.student_id, class_id, period, val, subject, type],
        );
      }
    }
    return { ok: true as const };
  });

  if ('error' in result) {
    if (result.error === 'already_locked') {
      return res.status(403).json({ code: 'already_locked', message: 'AV1/AV2 já lançadas. Somente a gestão pode alterá-las.' });
    }
    const msg = result.error === 'class_not_found' ? 'Turma não encontrada.' : 'Aluno inválido.';
    return res.status(result.error === 'class_not_found' ? 404 : 400).json({ code: result.error, message: msg });
  }
  res.json({ ok: true });
});
