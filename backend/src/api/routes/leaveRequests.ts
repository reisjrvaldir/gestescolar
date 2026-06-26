import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { dateSchema } from '../../lib/validation';

export const leaveRequestsRouter = Router();
leaveRequestsRouter.use(requireAuth);

const leaveSchema = z.object({
  type: z.enum(['folga', 'licenca', 'ferias']),
  start_date: dateSchema,
  end_date: dateSchema,
  reason: z.string().optional(),
});

// GET /api/leave-requests — admin vê todas; usuário vê só as próprias
leaveRequestsRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const isAdmin = ['school_admin', 'superadmin'].includes(req.ctx!.role);
    const params: unknown[] = [req.ctx!.schoolId];
    let filter = '';
    if (!isAdmin) {
      filter = ' and lr.user_id = $2';
      params.push(req.ctx!.profileId);
    }
    const { rows } = await c.query(
      `select lr.id, lr.type, lr.start_date, lr.end_date, lr.reason, lr.status,
              lr.created_at, lr.decided_at, lr.decision_note,
              p.name as user_name
         from public.leave_requests lr
         join public.profiles p on p.id = lr.user_id
        where lr.school_id = $1${filter}
        order by lr.created_at desc`,
      params,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

leaveRequestsRouter.post('/', async (req, res) => {
  const p = leaveSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  if (new Date(p.data.end_date) < new Date(p.data.start_date)) {
    return res.status(400).json({ code: 'validation', message: 'Data fim antes do início' });
  }
  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.leave_requests (school_id, user_id, type, start_date, end_date, reason)
       values ($1,$2,$3,$4,$5,$6)
       returning id, type, start_date, end_date, reason, status, created_at`,
      [req.ctx!.schoolId, req.ctx!.profileId, p.data.type, p.data.start_date,
       p.data.end_date, p.data.reason ?? null],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

leaveRequestsRouter.patch('/:id/decide', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const decision = req.body?.status;
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ code: 'validation', message: 'status deve ser approved|rejected' });
  }
  const updated = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `update public.leave_requests
          set status=$1, decided_by=$2, decided_at=now(), decision_note=$3
        where id=$4 and school_id=$5
        returning id, status, decided_at, decision_note`,
      [decision, req.ctx!.profileId, req.body?.decision_note ?? null,
       req.params.id, req.ctx!.schoolId],
    );
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found' });
  res.json({ ok: true, data: updated });
});
