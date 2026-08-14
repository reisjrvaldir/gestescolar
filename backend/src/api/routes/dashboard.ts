import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';
import { guardianCalendarWhere } from '../../lib/calendarScope';

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
                s.photo_url, s.birth_date::text, s.blood_type,
                cl.name as class_name, cl.year as class_year,
                (select count(*) from public.attendance a
                   where a.student_id = s.id and a.class_id = s.class_id and a.status = 'present'
                     and a.date >= date_trunc('month', now()))::int as present_month,
                (select count(*) from public.attendance a
                   where a.student_id = s.id and a.class_id = s.class_id and a.status = 'absent'
                     and a.date >= date_trunc('month', now()))::int as absent_month,
                (select coalesce(avg(g.grade),0)::numeric(4,2)
                   from public.grades g where g.student_id = s.id
                     and g.class_id = s.class_id) as avg_grade,
                (select count(*)::int from public.invoices i
                   where i.student_id = s.id and i.status in ('pending','overdue')) as open_invoices
           from public.students s
           left join public.classes cl on cl.id = s.class_id
          where s.guardian_id = $1 and s.school_id = $2 and s.status = 'active'`,
        [guardianId, schoolId],
      );

      const unread = await c.query(
        `select count(*)::int as total from public.messages
          where recipient_id = $1 and read_at is null`,
        [req.ctx!.profileId],
      );

      const now = new Date();
      // $1 = schoolId, $2 = profileId (user_id do guardian — mesma derivação do calendar.ts)
      const events = await c.query(
        `select id, title, description, date_start::text, date_end::text, event_type,
                to_char(start_time, 'HH24:MI') as start_time,
                to_char(end_time,   'HH24:MI') as end_time
           from public.school_calendar
          where school_id = $1
            and (date_start >= current_date
                 or (date_end is not null and date_end >= current_date))
            and ${guardianCalendarWhere('class_id', 1, 2)}
          order by date_start asc, start_time asc nulls last limit 6`,
        [schoolId, req.ctx!.profileId],
      );

      // Status efetivo em tempo real: fatura 'pending' com vencimento no passado
      // conta como atrasada (independe do cron que roda 1x/dia).
      const pendingInvoices = await c.query(
        `select i.id, i.student_name, i.amount::float8 as amount, i.due_date::text,
                case when i.status = 'pending' and i.due_date < current_date
                     then 'overdue' else i.status end as status,
                i.kind, i.reference_month
           from public.invoices i
           join public.students s on s.id = i.student_id
          where s.guardian_id = $1 and i.school_id = $2 and i.status in ('pending','overdue')
          order by i.due_date asc limit 10`,
        [guardianId, schoolId],
      );

      const overdueInvoices = await c.query(
        `select coalesce(sum(i.amount),0)::float8 as total, count(*)::int as count
           from public.invoices i
           join public.students s on s.id = i.student_id
          where s.guardian_id = $1 and i.school_id = $2
            and (i.status = 'overdue'
                 or (i.status = 'pending' and i.due_date < current_date))`,
        [guardianId, schoolId],
      );

      return {
        role: 'guardian',
        children: children.rows,
        unread_messages: unread.rows[0].total,
        upcoming_events: events.rows,
        pending_invoices: pendingInvoices.rows,
        overdue_total: Number(overdueInvoices.rows[0].total),
        overdue_count: overdueInvoices.rows[0].count,
      };
    }

    // ---------- Dashboard de STAFF ----------
    // Dados financeiros (receita, inadimplência, despesas, PIX, cobranças com
    // nomes de alunos) só para gestão/financeiro.
    const canSeeFinance = ['school_admin', 'financial', 'superadmin'].includes(role);

    // ---- Professor: escopo estrito às próprias turmas ----
    // Nenhuma query abaixo deve tocar alunos, turmas ou frequência fora das
    // turmas onde o professor é regente ou docente de disciplina.
    if (role === 'teacher') {
      const teacherRow = await c.query(
        `SELECT id FROM public.teachers WHERE user_id=$1 AND school_id=$2 LIMIT 1`,
        [req.ctx!.profileId, schoolId],
      );
      const teacherId: string | null = teacherRow.rows[0]?.id ?? null;
      if (!teacherId) {
        return { role: 'teacher', students: 0, classes: 0, attendance_today: 0, presence_pct: null, recent_activities: [] };
      }

      // Predicado reutilizado: turma pertence ao professor (regente ou disciplina).
      const myClassPred = `(c2.teacher_id=$2
          OR EXISTS (SELECT 1 FROM public.class_subjects cs2
                      WHERE cs2.class_id=c2.id AND cs2.teacher_id=$2))`;

      const [students, classes, attendanceToday, presenceToday] = await Promise.all([
        c.query(
          `SELECT count(*)::int AS total
             FROM public.students s
            WHERE s.school_id=$1 AND s.status='active'
              AND EXISTS (SELECT 1 FROM public.classes c2
                           WHERE c2.id=s.class_id AND c2.school_id=$1 AND c2.status='active'
                             AND ${myClassPred})`,
          [schoolId, teacherId],
        ),
        c.query(
          `SELECT count(*)::int AS total
             FROM public.classes c2
            WHERE c2.school_id=$1 AND c2.status='active' AND ${myClassPred}`,
          [schoolId, teacherId],
        ),
        c.query(
          `SELECT count(DISTINCT a.class_id)::int AS total
             FROM public.attendance a
            WHERE a.school_id=$1 AND a.date=current_date
              AND EXISTS (SELECT 1 FROM public.classes c2
                           WHERE c2.id=a.class_id AND c2.school_id=$1 AND ${myClassPred})`,
          [schoolId, teacherId],
        ),
        c.query(
          `SELECT round(100.0 * count(*) FILTER (WHERE a.status='present') / nullif(count(*),0))::int AS pct
             FROM public.attendance a
            WHERE a.school_id=$1 AND a.date=current_date
              AND EXISTS (SELECT 1 FROM public.classes c2
                           WHERE c2.id=a.class_id AND c2.school_id=$1 AND ${myClassPred})`,
          [schoolId, teacherId],
        ),
      ]);

      const acts = await c.query(
        `SELECT 'student' AS type, 'Novo aluno cadastrado' AS title, s.name AS subtitle, s.created_at AS at
           FROM public.students s
          WHERE s.school_id=$1
            AND EXISTS (SELECT 1 FROM public.classes c2
                         WHERE c2.id=s.class_id AND c2.school_id=$1 AND c2.status='active'
                           AND ${myClassPred})
          ORDER BY s.created_at DESC LIMIT 6`,
        [schoolId, teacherId],
      );

      return {
        role: 'teacher',
        students: students.rows[0].total,
        classes: classes.rows[0].total,
        attendance_today: attendanceToday.rows[0].total,
        presence_pct: presenceToday.rows[0].pct,
        recent_activities: acts.rows.map((r: any) => ({
          type: r.type, title: r.title, subtitle: r.subtitle, at: r.at,
        })),
      };
    }

    // ---- Coordinator e demais papéis de staff não-financeiro ----
    const [students, classes, teachers, attendanceToday, presenceToday, trialInfo] = await Promise.all([
      c.query(`select count(*)::int as total from public.students where school_id=$1 and status='active'`, [schoolId]),
      c.query(`select count(*)::int as total from public.classes where school_id=$1 and status='active'`, [schoolId]),
      c.query(`select count(*)::int as total from public.teachers where school_id=$1 and status='active'`, [schoolId]),
      c.query(`select count(distinct class_id)::int as total from public.attendance where school_id=$1 and date = current_date`, [schoolId]),
      c.query(
        `select round(100.0 * count(*) filter (where status = 'present') / nullif(count(*), 0))::int as pct
           from public.attendance where school_id=$1 and date = current_date`,
        [schoolId],
      ),
      c.query(`select subscription_status, trial_ends_at from public.schools where id=$1`, [schoolId]),
    ]);

    const school = trialInfo.rows[0] ?? {};
    let trialDaysLeft: number | null = null;
    if (school.subscription_status === 'trialing' && school.trial_ends_at) {
      const diff = new Date(school.trial_ends_at).getTime() - Date.now();
      trialDaysLeft = Math.max(0, Math.ceil(diff / 86_400_000));
    }

    const base = {
      role,
      students: students.rows[0].total,
      classes: classes.rows[0].total,
      teachers: teachers.rows[0].total,
      attendance_today: attendanceToday.rows[0].total,
      presence_pct: presenceToday.rows[0].pct,
      subscription_status: canSeeFinance ? (school.subscription_status ?? null) : null,
      trial_days_left: canSeeFinance ? trialDaysLeft : null,
    };

    // Coordenador: atividade operacional (novos alunos), sem financeiro.
    if (!canSeeFinance) {
      const acts = await c.query(
        `select 'student' as type, 'Novo aluno cadastrado' as title, s.name as subtitle, s.created_at as at
           from public.students s where s.school_id=$1
          order by s.created_at desc limit 6`,
        [schoolId],
      );
      return {
        ...base,
        recent_activities: acts.rows.map((r: any) => ({ type: r.type, title: r.title, subtitle: r.subtitle, at: r.at })),
      };
    }

    // Gestão/financeiro: indicadores financeiros completos.
    const [
      revenue, prevRevenue, overdue, expensesMonth, revenueSeries, upcomingCharges, recentActivities, pixSummary,
    ] = await Promise.all([
      c.query(
        `select coalesce(sum(amount),0)::float8 as total from public.invoices
          where school_id=$1 and status='paid' and paid_at >= date_trunc('month', now())`,
        [schoolId],
      ),
      c.query(
        `select coalesce(sum(amount),0)::float8 as total from public.invoices
          where school_id=$1 and status='paid'
            and paid_at >= date_trunc('month', now()) - interval '1 month'
            and paid_at <  date_trunc('month', now())`,
        [schoolId],
      ),
      c.query(
        `select coalesce(sum(amount),0)::float8 as total, count(*)::int as count
           from public.invoices where school_id=$1 and status='overdue'`,
        [schoolId],
      ),
      c.query(
        `select coalesce(sum(amount),0)::float8 as total from public.expenses
          where school_id=$1 and status='paid' and due_date >= date_trunc('month', now())`,
        [schoolId],
      ),
      c.query(
        `select d.month as month, coalesce(sum(i.amount),0)::float8 as total
           from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as d(month)
           left join public.invoices i on i.school_id=$1 and i.status='paid' and date_trunc('month', i.paid_at) = d.month
          group by d.month order by d.month`,
        [schoolId],
      ),
      c.query(
        `select i.id, i.amount::float8 as amount, i.due_date, i.status,
                s.name as student_name, cl.name as class_name
           from public.invoices i
           left join public.students s on s.id = i.student_id
           left join public.classes cl on cl.id = s.class_id
          where i.school_id=$1 and i.status in ('pending','overdue')
          order by i.due_date asc nulls last limit 5`,
        [schoolId],
      ),
      c.query(
        `select * from (
           (select 'payment' as type, 'Pagamento recebido' as title, s.name as subtitle, i.paid_at as at
              from public.invoices i left join public.students s on s.id=i.student_id
             where i.school_id=$1 and i.status='paid' and i.paid_at is not null
             order by i.paid_at desc limit 5)
           union all
           (select 'student', 'Novo aluno cadastrado', s.name, s.created_at
              from public.students s where s.school_id=$1 order by s.created_at desc limit 5)
           union all
           (select 'invoice', 'Cobrança gerada', s.name, i.created_at
              from public.invoices i left join public.students s on s.id=i.student_id
             where i.school_id=$1 order by i.created_at desc limit 5)
         ) t order by at desc nulls last limit 6`,
        [schoolId],
      ),
      c.query(
        `select count(*)::int as count,
                coalesce(sum(gross_amount),0)::float8 as total,
                coalesce(avg(gross_amount),0)::float8 as avg_ticket,
                coalesce(avg(case when status='paid' then 1.0 else 0 end),0)::float8 as success_rate
           from public.payments
          where school_id=$1 and payment_method='pix' and created_at >= date_trunc('month', now())`,
        [schoolId],
      ),
    ]);

    const revenueMonth = Number(revenue.rows[0].total);
    const prevRevenueMonth = Number(prevRevenue.rows[0].total);
    const revenueDelta = prevRevenueMonth > 0 ? ((revenueMonth - prevRevenueMonth) / prevRevenueMonth) * 100 : null;
    const expenses = Number(expensesMonth.rows[0].total);

    return {
      ...base,
      revenue_month: revenueMonth,
      revenue_delta_pct: revenueDelta,
      overdue_amount: Number(overdue.rows[0].total),
      overdue_count: overdue.rows[0].count,
      expenses_month: expenses,
      balance_month: revenueMonth - expenses,
      revenue_series: revenueSeries.rows.map((r: any) => ({
        month: new Date(r.month).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        total: Number(r.total),
      })),
      upcoming_charges: upcomingCharges.rows.map((r: any) => ({
        id: r.id, student_name: r.student_name, class_name: r.class_name,
        amount: Number(r.amount), due_date: r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : r.due_date, status: r.status,
      })),
      recent_activities: recentActivities.rows.map((r: any) => ({
        type: r.type, title: r.title, subtitle: r.subtitle, at: r.at,
      })),
      pix_summary: {
        count: pixSummary.rows[0].count,
        total: Number(pixSummary.rows[0].total),
        avg_ticket: Number(pixSummary.rows[0].avg_ticket),
        success_rate: Number(pixSummary.rows[0].success_rate),
      },
    };
  });
  res.json({ ok: true, data });
});
