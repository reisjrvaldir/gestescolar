import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';

export const searchRouter = Router();
searchRouter.use(requireAuth);

const ADMIN_ROLES = ['school_admin', 'superadmin'] as const;
const FINANCIAL_ROLES = ['school_admin', 'financial', 'superadmin'] as const;

/**
 * GET /api/search?q=<term>
 * Busca global multi-entidade da escola autenticada.
 * Isolamento garantido por withTenant (school_id em cada query).
 * CPF nunca incluído na busca.
 */
searchRouter.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  // Mínimo 2 caracteres para evitar queries explosivas.
  if (q.length < 2) return res.json({ ok: true, data: [] });

  const term = `%${q}%`;
  const role = req.ctx!.role;

  const results = await withTenant(req.ctx!, async (c) => {
    const sid = req.ctx!.schoolId;
    const pending: Promise<{ id: string; name: string; context: string | null; type: string }[]>[] = [];

    // Alunos — todos exceto responsável (que só vê o próprio filho)
    if (role !== 'guardian') {
      pending.push(
        c.query<{ id: string; name: string; context: string | null; type: string }>(
          `select id::text, name,
                  coalesce(registration_number, '') as context,
                  'student' as type
             from public.students
            where school_id=$1 and status='active'
              and (name ilike $2 or registration_number ilike $2)
            order by name limit 5`,
          [sid, term],
        ).then((r) => r.rows),
      );
    }

    // Responsáveis — financeiro e admin
    if ((FINANCIAL_ROLES as readonly string[]).includes(role)) {
      pending.push(
        c.query<{ id: string; name: string; context: string | null; type: string }>(
          `select id::text, name,
                  coalesce(email, '') as context,
                  'guardian' as type
             from public.guardians
            where school_id=$1
              and (name ilike $2 or email ilike $2)
            order by name limit 5`,
          [sid, term],
        ).then((r) => r.rows),
      );
    }

    // Funcionários — apenas admin
    if ((ADMIN_ROLES as readonly string[]).includes(role)) {
      pending.push(
        c.query<{ id: string; name: string; context: string | null; type: string }>(
          `select id::text, name,
                  coalesce(registration_number, '') as context,
                  'teacher' as type
             from public.teachers
            where school_id=$1 and status='active'
              and (name ilike $2 or registration_number ilike $2 or email ilike $2)
            order by name limit 5`,
          [sid, term],
        ).then((r) => r.rows),
      );
    }

    // Turmas — todos exceto responsável
    if (role !== 'guardian') {
      pending.push(
        c.query<{ id: string; name: string; context: string | null; type: string }>(
          `select id::text, name,
                  null::text as context,
                  'class' as type
             from public.classes
            where school_id=$1 and status='active'
              and name ilike $2
            order by name limit 5`,
          [sid, term],
        ).then((r) => r.rows),
      );
    }

    // Cobranças — financeiro e admin
    if ((FINANCIAL_ROLES as readonly string[]).includes(role)) {
      pending.push(
        c.query<{ id: string; name: string; context: string | null; type: string }>(
          `select id::text,
                  student_name as name,
                  to_char(amount, 'FM"R$"999G999G990D00') as context,
                  'invoice' as type
             from public.invoices
            where school_id=$1
              and student_name ilike $2
              and status not in ('cancelled','refunded')
            order by due_date desc limit 5`,
          [sid, term],
        ).then((r) => r.rows),
      );
    }

    // Chamados — apenas admin
    if ((ADMIN_ROLES as readonly string[]).includes(role)) {
      pending.push(
        c.query<{ id: string; name: string; context: string | null; type: string }>(
          `select id::text,
                  title as name,
                  status as context,
                  'ticket' as type
             from public.support_tickets
            where school_id=$1
              and title ilike $2
            order by created_at desc limit 5`,
          [sid, term],
        ).then((r) => r.rows),
      );
    }

    const chunks = await Promise.all(pending);
    return chunks.flat();
  });

  res.json({ ok: true, data: results });
});
