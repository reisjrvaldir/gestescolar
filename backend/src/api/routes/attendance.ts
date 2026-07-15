import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const attendanceRouter = Router();

const batchSchema = z.object({
  class_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subject_id: z.string().uuid().optional(),
  entries: z.array(z.object({
    student_id: z.string().uuid(),
    status: z.enum(['present', 'absent', 'justified', 'attested']),
    justification: z.string().nullish(), // aceita null ou undefined do banco
  })).max(500),
});

const attestationSchema = z.object({
  student_id: z.string().uuid(),
  class_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  filename: z.string().min(1),
  file_size: z.number().int().positive().max(5 * 1024 * 1024), // 5 MB
  file_data: z.string().min(1), // base64
});

attendanceRouter.use(requireAuth);

attendanceRouter.get('/', async (req, res) => {
  const { class_id, date } = req.query;
  const subjectId = (req.query.subject_id as string | undefined) || null;
  if (!class_id || !date) {
    return res.status(400).json({ code: 'validation', message: 'class_id e date são obrigatórios' });
  }
  const result = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select a.id, a.student_id, a.status, a.justification, s.name as student_name
         from public.attendance a
         join public.students s on s.id = a.student_id
        where a.school_id = $1 and a.class_id = $2 and a.date = $3
          and (($4::uuid is null and a.subject_id is null) or a.subject_id = $4)
          and exists (select 1 from public.classes cl where cl.id = $2 and cl.school_id = $1)
        order by s.name asc`,
      [req.ctx!.schoolId, class_id, date, subjectId],
    );
    return rows;
  });
  res.json({ ok: true, data: result, locked: result.length > 0 });
});

// GET /attendance/calendar?class_id=&year=&month=
attendanceRouter.get('/calendar', async (req, res) => {
  const { class_id, year, month } = req.query;
  if (!class_id || !year || !month) {
    return res.status(400).json({ code: 'validation', message: 'class_id, year e month são obrigatórios' });
  }
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select
          a.date::text as date,
          a.subject_id,
          count(*) as total,
          count(*) filter (where a.status = 'present')   as present,
          count(*) filter (where a.status = 'absent')    as absent,
          count(*) filter (where a.status = 'justified') as justified,
          count(*) filter (where a.status = 'attested')  as attested
         from public.attendance a
        where a.school_id = $1
          and a.class_id = $2
          and extract(year  from a.date) = $3
          and extract(month from a.date) = $4
        group by a.date, a.subject_id
        order by a.date asc`,
      [req.ctx!.schoolId, class_id, Number(year), Number(month)],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// POST /attendance/attestation — upload PDF de atestado
attendanceRouter.post('/attestation', requireRole('school_admin', 'teacher', 'superadmin'), async (req, res) => {
  const parsed = attestationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  }
  const { student_id, class_id, date, filename, file_size, file_data } = parsed.data;
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `insert into public.attendance_attestations
         (school_id, student_id, class_id, date, filename, file_size, file_data)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (school_id, student_id, class_id, date)
       do update set filename=$5, file_size=$6, file_data=$7, uploaded_at=now()`,
      [req.ctx!.schoolId, student_id, class_id, date, filename, file_size, file_data],
    );
  });
  res.status(201).json({ ok: true });
});

// GET /attendance/attestation?student_id=&class_id=&date= — download atestado
attendanceRouter.get('/attestation', async (req, res) => {
  const { student_id, class_id, date } = req.query;
  if (!student_id || !class_id || !date) {
    return res.status(400).json({ code: 'validation', message: 'student_id, class_id e date são obrigatórios' });
  }
  const row = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select filename, file_data from public.attendance_attestations
        where school_id=$1 and student_id=$2 and class_id=$3 and date=$4 limit 1`,
      [req.ctx!.schoolId, student_id, class_id, date],
    );
    return rows[0] ?? null;
  });
  if (!row) return res.status(404).json({ code: 'not_found' });
  const buf = Buffer.from(row.file_data, 'base64');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${row.filename}"`);
  res.send(buf);
});

attendanceRouter.post('/batch', requireRole('school_admin', 'teacher', 'superadmin'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  }
  const { class_id, date, subject_id, entries } = parsed.data;
  const subjectId = subject_id ?? null;

  const result = await withTenant(req.ctx!, async (c) => {
    const cls = await c.query(
      `select 1 from public.classes where id=$1 and school_id=$2 limit 1`,
      [class_id, req.ctx!.schoolId],
    );
    if (cls.rows.length === 0) return { error: 'class_not_found' as const };

    if (subjectId) {
      const sub = await c.query(`select 1 from public.subjects where id=$1 and school_id=$2 limit 1`, [subjectId, req.ctx!.schoolId]);
      if (sub.rows.length === 0) return { error: 'invalid_subject' as const };
    }

    // Professor não pode substituir chamada já salva
    if (req.ctx!.role === 'teacher') {
      const existing = await c.query(
        `select 1 from public.attendance
          where school_id=$1 and class_id=$2 and date=$3
            and (($4::uuid is null and subject_id is null) or subject_id=$4)
          limit 1`,
        [req.ctx!.schoolId, class_id, date, subjectId],
      );
      if (existing.rows.length > 0) return { error: 'already_locked' as const };
    }

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
        where school_id=$1 and class_id=$2 and date=$3
          and (($4::uuid is null and subject_id is null) or subject_id=$4)`,
      [req.ctx!.schoolId, class_id, date, subjectId],
    );
    const teacherRow = await c.query(
      `select t.id from public.teachers t where t.user_id=$1 and t.school_id=$2 limit 1`,
      [req.ctx!.profileId, req.ctx!.schoolId],
    );
    const teacherId = teacherRow.rows[0]?.id ?? null;
    for (const e of entries) {
      await c.query(
        `insert into public.attendance (school_id, student_id, class_id, teacher_id, date, status, justification, subject_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.ctx!.schoolId, e.student_id, class_id, teacherId, date, e.status, e.justification ?? null, subjectId],
      );
    }
    return { ok: true as const };
  });

  if ('error' in result) {
    if (result.error === 'already_locked') {
      return res.status(403).json({ code: 'already_locked', message: 'Chamada já encerrada. Somente a gestão pode alterá-la.' });
    }
    const msg = result.error === 'class_not_found' ? 'Turma não encontrada nesta escola.'
      : result.error === 'invalid_subject' ? 'Matéria inválida para esta escola.'
      : 'Aluno inválido para esta escola.';
    return res.status(result.error === 'class_not_found' ? 404 : 400).json({ code: result.error, message: msg });
  }
  res.json({ ok: true });
});
