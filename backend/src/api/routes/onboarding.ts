import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const onboardingRouter = Router();

onboardingRouter.use(requireAuth);

/** GET /api/onboarding/status — checklist de configuração inicial da escola. */
onboardingRouter.get('/status', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const [plans, classes, staff, students, settings] = await Promise.all([
      c.query(`select 1 from public.school_plans where school_id=$1 limit 1`, [req.ctx!.schoolId]),
      c.query(`select 1 from public.classes where school_id=$1 and status='active' limit 1`, [req.ctx!.schoolId]),
      c.query(`select 1 from public.teachers where school_id=$1 and status='active' limit 1`, [req.ctx!.schoolId]),
      c.query(`select 1 from public.students where school_id=$1 and status='active' limit 1`, [req.ctx!.schoolId]),
      c.query(`select asaas_account_id from public.schools where id=$1`, [req.ctx!.schoolId]),
    ]);
    const has_plan     = plans.rows.length > 0;
    const has_class    = classes.rows.length > 0;
    const has_staff    = staff.rows.length > 0;
    const has_student  = students.rows.length > 0;
    const payment_ready = !!(settings.rows[0]?.asaas_account_id);
    const complete = has_plan && has_class && has_staff && has_student && payment_ready;
    return { has_plan, has_class, has_staff, has_student, payment_ready, complete };
  });
  res.json({ ok: true, data });
});
