import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get('/stats', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const schoolId = req.ctx!.schoolId;
    const role = req.ctx!.role;

    // ---------- Dashboard do responsável (guardian) ----------
    // Sem trial/assinatura/pagamentos — só dados do(s) filho(s).
    if (role === 'guardian') {
      const guardianRow = await c.query(
        `select id from public.guardians where user_id = $1 limit 1`,
        [req.ctx!.profileId],
      );
      const guardianId = guardianRow.rows[0]?.id;
      if (!guardianId) {
        return {
          role: 'guardian',
          children: [],
          unread_messages: 0,
        };
      }

      const children = await c.query(
        `select s.id, s.name, s.registration_number, s.monthly_fee::float8 as monthly_fee,
                cl.name as class_name,
                (select count(*) from public.attendance a
                   where a.student_id = s.id and a.status = 'present'
                     and a.date >= date_trunc('month', now()))::int as present_month,
                (select count(*) from public.attendance a
                   where a.student_id = s.id and a.status = 'absent'
                     and a.date >= date_trunc('month', now()))::int as absent_month,
                (select coalesce(avg(g.grade),0)::numeric(4,2)
                   from public.grades g where g.student_id = s.id
                     and g.created_at >= date_trunc('year', now())) as avg_grade,
                (select count(*)::int from public.invoices i
                   where i.student_id = s.id and i.status in ('pending','overdue')) as open_invoices
           from public.students s
           left join public.classes cl on cl.id = s.class_id
          where s.guardian_id = $1 and s.school_id = $2`,
        [guardianId, schoolId],
      );

      const unread = await c.query(
        `select count(*)::int as total from public.messages
          where recipient_id = $1 and read_at is null`,
        [req.ctx!.profileId],
      );

      return {
        role: 'guardian',
        children: children.rows,
        unread_messages: unread.rows[0].total,
      };
    }

    // ---------- Dashboard padrão (admin/financial/teacher) ----------
    const [students, classes, teachers, revenue, overdue, attendanceToday, trialInfo] =
      await Promise.all([
        c.query(
          `select count(*)::int as total from public.students where school_id=$1 and status='active'`,
          [schoolId],
        ),
        c.query(
          `select count(*)::int as total from public.classes where school_id=$1 and status='active'`,
          [schoolId],
        ),
        c.query(
          `select count(*)::int as total from public.teachers where school_id=$1 and status='active'`,
          [schoolId],
        ),
        c.query(
          `select coalesce(sum(amount),0)::numeric as total
             from public.invoices
            where school_id=$1 and status='paid'
              and paid_at >= date_trunc('month', now())`,
          [schoolId],
        ),
        c.query(
          `select coalesce(sum(amount),0)::numeric as total, count(*)::int as count
             from public.invoices
            where school_id=$1 and status='overdue'`,
          [schoolId],
        ),
        c.query(
          `select count(distinct class_id)::int as total
             from public.attendance
            where school_id=$1 and date = current_date`,
          [schoolId],
        ),
        c.query(
          `select subscription_status, trial_ends_at from public.schools where id=$1`,
          [schoolId],
        ),
      ]);

    const school = trialInfo.rows[0] ?? {};
    let trialDaysLeft: number | null = null;
    if (school.subscription_status === 'trialing' && school.trial_ends_at) {
      const diff = new Date(school.trial_ends_at).getTime() - Date.now();
      trialDaysLeft = Math.max(0, Math.ceil(diff / 86_400_000));
    }

    return {
      role,
      students: students.rows[0].total,
      classes: classes.rows[0].total,
      teachers: teachers.rows[0].total,
      revenue_month: Number(revenue.rows[0].total),
      overdue_amount: Number(overdue.rows[0].total),
      overdue_count: overdue.rows[0].count,
      attendance_today: attendanceToday.rows[0].total,
      subscription_status: school.subscription_status ?? null,
      trial_days_left: trialDaysLeft,
    };
  });
  res.json({ ok: true, data });
});
