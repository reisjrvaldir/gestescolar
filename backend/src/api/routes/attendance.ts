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
    status: z.enum(['present', 'absent', 'justified', 'attested', 'excused']),
    justification: z.string().max(100).optional(),
  })).max(500),
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
      `select a.id, a.student_id, a.status, a.justification, s.name as student_name, s.registration_number
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

// GET /attendance/calendar?class_id=&year=&month= → dias com chamada registrada
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
          count(*) filter (where a.status = 'present') as present,
          count(*) filter (where a.status = 'absent') as absent,
          count(*) filter (where a.status = 'justified') as justified,
          count(*) filter (where a.status = 'attested') as attested,
          count(*) filter (where a.status = 'excused') as excused
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

// GET /attendance/summary?class_id=&scope=month|30d → contagem para o gráfico de pizza
attendanceRouter.get('/summary', async (req, res) => {
  const classId = (req.query.class_id as string | undefined) || null;
  const scope = req.query.scope === '30d' ? '30d' : 'month';
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select
          count(*) filter (where status = 'present')   as present,
          count(*) filter (where status = 'absent')     as absent,
          count(*) filter (where status = 'justified')  as justified,
          count(*) filter (where status = 'attested')   as attested,
          count(*) filter (where status = 'excused')    as excused
         from public.attendance
        where school_id = $1
          and ($2::uuid is null or class_id = $2)
          and date >= ${scope === '30d' ? `current_date - interval '29 days'` : `date_trunc('month', current_date)`}
          and date <= current_date`,
      [req.ctx!.schoolId, classId],
    );
    return rows[0];
  });
  res.json({ ok: true, data });
});

// GET /attendance/top-absences?class_id=&year=&month=&limit=5 → alunos com mais faltas no mês
attendanceRouter.get('/top-absences', async (req, res) => {
  const classId = (req.query.class_id as string | undefined) || null;
  const limit = Math.min(Number(req.query.limit) || 5, 20);
  const now = new Date();
  const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select a.student_id, s.name as student_name, cl.name as class_name, count(*)::int as absences
         from public.attendance a
         join public.students s on s.id = a.student_id
         left join public.classes cl on cl.id = a.class_id
        where a.school_id = $1
          and a.status in ('absent', 'attested')
          and ($2::uuid is null or a.class_id = $2)
          and extract(year  from a.date) = $3
          and extract(month from a.date) = $4
        group by a.student_id, s.name, cl.name
        order by count(*) desc
        limit $5`,
      [req.ctx!.schoolId, classId, year, month, limit],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /attendance/school-events?year=&month= → eventos do calendário escolar no mês
attendanceRouter.get('/school-events', async (req, res) => {
  const now = new Date();
  const year  = req.query.year  ? Number(req.query.year)  : now.getFullYear();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10);
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, title, date_start::text, date_end::text, event_type
         from public.school_calendar
        where school_id = $1
          and date_start <= $2
          and (date_end is null or date_end >= $3)
        order by date_start`,
      [req.ctx!.schoolId, lastDay, firstDay],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /attendance/pending-approvals → fila de atestados aguardando análise (só gestão)
attendanceRouter.get('/pending-approvals', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select att.id, att.student_id, s.name as student_name, att.class_id, cl.name as class_name,
              att.date::text as date, att.filename, att.file_size, att.uploaded_at, att.uploaded_by_guardian
         from public.attendance_attestations att
         join public.students s on s.id = att.student_id
         left join public.classes cl on cl.id = att.class_id
        where att.school_id = $1 and att.status = 'pending'
        order by att.uploaded_at asc`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(300).optional(),
});

// POST /attendance/attestation/:id/review → aprova (abono) ou recusa (volta a falta)
attendanceRouter.post('/attestation/:id/review', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  const { action, note } = parsed.data;

  const result = await withTenant(req.ctx!, async (c) => {
    const att = await c.query(
      `select id, student_id, class_id, date from public.attendance_attestations where id=$1 and school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
    if (att.rows.length === 0) return { error: 'not_found' as const };
    const a = att.rows[0];

    const newAttStatus = action === 'approve' ? 'approved' : 'rejected';
    await c.query(
      `update public.attendance_attestations
          set status=$1, reviewed_by=$2, reviewed_at=now(), review_note=$3
        where id=$4`,
      [newAttStatus, req.ctx!.profileId, note ?? null, req.params.id],
    );

    const newStatus = action === 'approve' ? 'excused' : 'absent';
    const existing = await c.query(
      `select id from public.attendance
        where school_id=$1 and student_id=$2 and class_id=$3 and date=$4 and subject_id is null`,
      [req.ctx!.schoolId, a.student_id, a.class_id, a.date],
    );
    if (existing.rows.length > 0) {
      await c.query(`update public.attendance set status=$1 where id=$2`, [newStatus, existing.rows[0].id]);
    } else if (action === 'approve') {
      await c.query(
        `insert into public.attendance (school_id, student_id, class_id, date, status)
         values ($1, $2, $3, $4, $5)`,
        [req.ctx!.schoolId, a.student_id, a.class_id, a.date, newStatus],
      );
    }
    return { ok: true as const };
  });

  if ('error' in result) return res.status(404).json({ code: 'not_found', message: 'Atestado não encontrado.' });
  res.json({ ok: true });
});

// GET /attendance/my-children → filhos do responsável autenticado (para o portal)
attendanceRouter.get('/my-children', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const g = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [req.ctx!.profileId]);
    if (g.rows.length === 0) return [];
    const { rows } = await c.query(
      `select s.id as student_id, s.name as student_name, s.class_id, cl.name as class_name
         from public.students s
         left join public.classes cl on cl.id = s.class_id
        where s.guardian_id = $1 and s.school_id = $2
        order by s.name`,
      [g.rows[0].id, req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /attendance/my-calendar?student_id=&year=&month= → calendário de presença do filho
attendanceRouter.get('/my-calendar', async (req, res) => {
  const { student_id, year, month } = req.query;
  if (!student_id || !year || !month) {
    return res.status(400).json({ code: 'validation', message: 'student_id, year e month são obrigatórios' });
  }
  const data = await withTenant(req.ctx!, async (c) => {
    const g = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [req.ctx!.profileId]);
    if (g.rows.length === 0) return [];
    const stu = await c.query(
      `select 1 from public.students where id=$1 and guardian_id=$2 and school_id=$3`,
      [student_id, g.rows[0].id, req.ctx!.schoolId],
    );
    if (stu.rows.length === 0) return [];
    const { rows } = await c.query(
      `select a.date::text as date, a.status
         from public.attendance a
        where a.school_id = $1 and a.student_id = $2
          and extract(year from a.date) = $3
          and extract(month from a.date) = $4
        order by a.date asc`,
      [req.ctx!.schoolId, student_id, Number(year), Number(month)],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /attendance/my-summary?student_id= → resumo mensal de presença do filho
attendanceRouter.get('/my-summary', async (req, res) => {
  const { student_id } = req.query;
  if (!student_id) {
    return res.status(400).json({ code: 'validation', message: 'student_id é obrigatório' });
  }
  const data = await withTenant(req.ctx!, async (c) => {
    const g = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [req.ctx!.profileId]);
    if (g.rows.length === 0) return { present: 0, absent: 0, justified: 0, attested: 0, excused: 0, total_school_days: 0 };
    const stu = await c.query(
      `select 1 from public.students where id=$1 and guardian_id=$2 and school_id=$3`,
      [student_id, g.rows[0].id, req.ctx!.schoolId],
    );
    if (stu.rows.length === 0) return { present: 0, absent: 0, justified: 0, attested: 0, excused: 0, total_school_days: 0 };
    const { rows } = await c.query(
      `select
          count(*) filter (where status='present')::int as present,
          count(*) filter (where status='absent')::int as absent,
          count(*) filter (where status='justified')::int as justified,
          count(*) filter (where status='attested')::int as attested,
          count(*) filter (where status='excused')::int as excused,
          count(distinct date)::int as total_school_days
         from public.attendance
        where school_id=$1 and student_id=$2
          and date >= date_trunc('month', current_date) and date <= current_date`,
      [req.ctx!.schoolId, student_id],
    );
    return rows[0];
  });
  res.json({ ok: true, data });
});

// GET /attendance/attestation/mine → atestados enviados pelo responsável autenticado
attendanceRouter.get('/attestation/mine', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const g = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [req.ctx!.profileId]);
    if (g.rows.length === 0) return [];
    const { rows } = await c.query(
      `select att.id, att.student_id, s.name as student_name, att.date::text as date,
              att.filename, att.status, att.uploaded_at, att.review_note
         from public.attendance_attestations att
         join public.students s on s.id = att.student_id
        where s.guardian_id = $1 and att.school_id = $2
        order by att.uploaded_at desc`,
      [g.rows[0].id, req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

const guardianUploadSchema = z.object({
  student_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  filename: z.string().min(1),
  file_size: z.number().int().positive().max(5 * 1024 * 1024),
  file_data: z.string().min(1),
});

// POST /attendance/attestation/mine → responsável envia atestado de um filho (aguarda análise)
attendanceRouter.post('/attestation/mine', async (req, res) => {
  const parsed = guardianUploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  const { student_id, date, filename, file_size, file_data } = parsed.data;

  const result = await withTenant(req.ctx!, async (c) => {
    const g = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [req.ctx!.profileId]);
    if (g.rows.length === 0) return { error: 'not_guardian' as const };
    const stu = await c.query(
      `select class_id from public.students where id=$1 and guardian_id=$2 and school_id=$3`,
      [student_id, g.rows[0].id, req.ctx!.schoolId],
    );
    if (stu.rows.length === 0) return { error: 'invalid_student' as const };
    const classId = stu.rows[0].class_id;
    if (!classId) return { error: 'no_class' as const };

    await c.query(
      `insert into public.attendance_attestations
         (school_id, student_id, class_id, date, filename, file_size, file_data, status, uploaded_by_guardian)
       values ($1,$2,$3,$4,$5,$6,$7,'pending', true)
       on conflict (school_id, student_id, class_id, date)
       do update set filename=$5, file_size=$6, file_data=$7, status='pending', uploaded_by_guardian=true,
                      reviewed_by=null, reviewed_at=null, review_note=null, uploaded_at=now()`,
      [req.ctx!.schoolId, student_id, classId, date, filename, file_size, file_data],
    );
    return { ok: true as const };
  });

  if ('error' in result) {
    const msg = result.error === 'not_guardian' ? 'Apenas responsáveis podem enviar atestados por aqui.'
      : result.error === 'no_class' ? 'Aluno sem turma vinculada.'
      : 'Aluno não encontrado para este responsável.';
    return res.status(400).json({ code: result.error, message: msg });
  }
  res.json({ ok: true });
});

// GET /attendance/attestation?student_id=&class_id=&date= → dados do PDF de um atestado
attendanceRouter.get('/attestation', async (req, res) => {
  const { student_id, class_id, date } = req.query;
  if (!student_id || !class_id || !date) {
    return res.status(400).json({ code: 'validation', message: 'student_id, class_id e date são obrigatórios' });
  }
  const row = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select filename, file_size, file_data, status, review_note from public.attendance_attestations
        where school_id=$1 and student_id=$2 and class_id=$3 and date=$4 limit 1`,
      [req.ctx!.schoolId, student_id, class_id, date],
    );
    return rows[0] ?? null;
  });
  if (!row) return res.status(404).json({ code: 'not_found' });
  res.json({
    ok: true,
    data: {
      filename: row.filename,
      file_size: row.file_size,
      file_data: row.file_data,
      status: row.status,
      review_note: row.review_note,
    },
  });
});

// POST /attendance/attestation → professor/gestão anexa o PDF (fica pendente de aprovação)
attendanceRouter.post('/attestation', requireRole('school_admin', 'teacher', 'superadmin'), async (req, res) => {
  const parsed = z.object({
    student_id: z.string().uuid(),
    class_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    filename: z.string().min(1),
    file_size: z.number().int().positive().max(5 * 1024 * 1024),
    file_data: z.string().min(1),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  const { student_id, class_id, date, filename, file_size, file_data } = parsed.data;

  const result = await withTenant(req.ctx!, async (c) => {
    const cls = await c.query(`select 1 from public.classes where id=$1 and school_id=$2 limit 1`, [class_id, req.ctx!.schoolId]);
    if (cls.rows.length === 0) return { error: 'class_not_found' as const };
    const stu = await c.query(`select 1 from public.students where id=$1 and school_id=$2 limit 1`, [student_id, req.ctx!.schoolId]);
    if (stu.rows.length === 0) return { error: 'invalid_student' as const };

    await c.query(
      `insert into public.attendance_attestations (school_id, student_id, class_id, date, filename, file_size, file_data, status, uploaded_by_guardian)
       values ($1,$2,$3,$4,$5,$6,$7,'pending', false)
       on conflict (school_id, student_id, class_id, date)
       do update set filename=$5, file_size=$6, file_data=$7, status='pending', uploaded_by_guardian=false,
                      reviewed_by=null, reviewed_at=null, review_note=null, uploaded_at=now()`,
      [req.ctx!.schoolId, student_id, class_id, date, filename, file_size, file_data],
    );
    return { ok: true as const };
  });

  if ('error' in result) {
    const msg = result.error === 'class_not_found' ? 'Turma não encontrada nesta escola.' : 'Aluno inválido para esta escola.';
    return res.status(result.error === 'class_not_found' ? 404 : 400).json({ code: result.error, message: msg });
  }
  res.json({ ok: true });
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

    const role = req.ctx!.role;
    if (role === 'teacher') {
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
        where school_id = $1 and class_id = $2 and date = $3
          and (($4::uuid is null and subject_id is null) or subject_id = $4)`,
      [req.ctx!.schoolId, class_id, date, subjectId],
    );
    const teacherRow = await c.query(
      `select t.id from public.teachers t where t.user_id = $1 and t.school_id = $2 limit 1`,
      [req.ctx!.profileId, req.ctx!.schoolId],
    );
    const teacherId = teacherRow.rows[0]?.id ?? null;
    for (const e of entries) {
      await c.query(
        `insert into public.attendance (school_id, student_id, class_id, teacher_id, date, status, justification, subject_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
