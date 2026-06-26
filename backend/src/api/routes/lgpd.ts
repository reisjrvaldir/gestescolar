import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';

export const lgpdRouter = Router();
lgpdRouter.use(requireAuth);

lgpdRouter.get('/requests', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, request_type, status, created_at, completed_at
         from public.lgpd_requests
        where user_id = $1
        order by created_at desc`,
      [req.ctx!.profileId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

lgpdRouter.post('/export', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const profileId = req.ctx!.profileId;
    const schoolId = req.ctx!.schoolId;

    const isAdmin = ['school_admin', 'superadmin'].includes(req.ctx!.role);
    const [profile, students, invoices] = await Promise.all([
      c.query(`select name, email, phone, role, created_at from public.profiles where id=$1`, [profileId]),
      isAdmin
        ? c.query(`select name, registration_number, status, created_at from public.students where school_id=$1`, [schoolId])
        : c.query(
            `select s.name, s.registration_number, s.status, s.created_at
               from public.students s
               join public.guardians g on g.id = s.guardian_id
              where g.user_id = $1 and s.school_id = $2`,
            [profileId, schoolId],
          ),
      isAdmin
        ? c.query(`select student_name, amount, due_date, status, created_at from public.invoices where school_id=$1`, [schoolId])
        : c.query(
            `select i.student_name, i.amount, i.due_date, i.status, i.created_at
               from public.invoices i
               join public.students s on s.id = i.student_id
               join public.guardians g on g.id = s.guardian_id
              where g.user_id = $1 and i.school_id = $2`,
            [profileId, schoolId],
          ),
    ]);

    await c.query(
      `insert into public.lgpd_requests (school_id, user_id, request_type, status, completed_at)
       values ($1, $2, 'export', 'completed', now())`,
      [schoolId, profileId],
    );

    return {
      profile: profile.rows[0] ?? null,
      students: students.rows,
      invoices: invoices.rows,
      exported_at: new Date().toISOString(),
    };
  });
  res.json({ ok: true, data });
});

lgpdRouter.post('/deletion', async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `insert into public.lgpd_requests (school_id, user_id, request_type, status)
       values ($1, $2, 'deletion', 'pending')`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
  });
  res.status(201).json({ ok: true, message: 'Solicitação de exclusão registrada.' });
});
