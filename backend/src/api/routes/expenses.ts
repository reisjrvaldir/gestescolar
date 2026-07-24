import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { dateSchema } from '../../lib/validation';

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

const ROLES = ['school_admin', 'financial', 'superadmin'] as const;
const TRASH_TTL_DAYS = 60;

const SELECT_COLS = `
  id, supplier_name, description, category,
  amount::float8 as amount,
  due_date, status,
  paid_at, deleted_at,
  installment_group_id, installment_number, installment_total,
  created_at, updated_at
`;

async function logAudit(
  c: any,
  args: {
    schoolId: string;
    expenseId: string;
    action: string;
    actorId?: string | null;
    actorRole?: string | null;
    before?: unknown;
    after?: unknown;
  },
) {
  await c.query(
    `insert into public.expense_audit_log
       (school_id, expense_id, action, actor_id, actor_role, before, after)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      args.schoolId,
      args.expenseId,
      args.action,
      args.actorId ?? null,
      args.actorRole ?? null,
      args.before ? JSON.stringify(args.before) : null,
      args.after ? JSON.stringify(args.after) : null,
    ],
  );
}

// ---------- Listagem (com filtros de auditoria + lixeira) ----------
expensesRouter.get('/', requireRole(...ROLES), async (req, res) => {
  const trash = req.query.trash === 'true';
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const supplier = typeof req.query.supplier === 'string' ? req.query.supplier : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;

  const data = await withTenant(req.ctx!, async (c) => {
    const params: any[] = [req.ctx!.schoolId];
    let where = 'school_id = $1';
    where += trash ? ' and deleted_at is not null' : ' and deleted_at is null';
    if (status) { params.push(status); where += ` and status = $${params.length}`; }
    if (category) { params.push(category); where += ` and category = $${params.length}`; }
    if (supplier) { params.push(`%${supplier}%`); where += ` and supplier_name ilike $${params.length}`; }
    if (from) { params.push(from); where += ` and due_date >= $${params.length}`; }
    if (to) { params.push(to); where += ` and due_date <= $${params.length}`; }
    const { rows } = await c.query(
      `select ${SELECT_COLS} from public.expenses
        where ${where}
        order by ${trash ? 'deleted_at desc' : 'due_date desc nulls last'}`,
      params,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// ---------- Criação (avulsa ou parcelada) ----------
const baseExpense = z.object({
  supplier_name: z.string().min(1, 'Informe o fornecedor'),
  description: z.string().optional(),
  category: z.string().optional(),
  amount: z.number().positive('Valor deve ser positivo'),
  due_date: dateSchema.optional(),
});

const createSchema = baseExpense.extend({
  installments: z.number().int().min(1).max(60).optional(),
  installment_mode: z.enum(['total', 'each']).optional(),
});

function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(y, (m - 1) + months, d));
  return base.toISOString().slice(0, 10);
}

expensesRouter.post('/', requireRole(...ROLES), async (req, res) => {
  const p = createSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });

  const inst = p.data.installments && p.data.installments > 1 ? p.data.installments : 1;
  const perInstallment = inst > 1 && p.data.installment_mode === 'total'
    ? Math.round((p.data.amount / inst) * 100) / 100
    : p.data.amount;

  const created = await withTenant(req.ctx!, async (c) => {
    const groupId = inst > 1 ? randomUUID() : null;
    const rows: any[] = [];
    for (let i = 1; i <= inst; i++) {
      const due = p.data.due_date ? addMonthsIso(p.data.due_date, i - 1) : null;
      const { rows: r } = await c.query(
        `insert into public.expenses
           (school_id, supplier_name, description, category, amount, due_date, status,
            installment_group_id, installment_number, installment_total)
         values ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9)
         returning ${SELECT_COLS}`,
        [
          req.ctx!.schoolId,
          p.data.supplier_name,
          p.data.description ?? null,
          p.data.category ?? null,
          perInstallment,
          due,
          groupId,
          inst > 1 ? i : null,
          inst > 1 ? inst : null,
        ],
      );
      rows.push(r[0]);
      await logAudit(c, {
        schoolId: req.ctx!.schoolId,
        expenseId: r[0].id,
        action: 'create',
        actorId: req.ctx!.profileId,
        actorRole: req.ctx!.role,
        after: r[0],
      });
    }
    return rows;
  });
  res.status(201).json({ ok: true, data: created });
});

// ---------- Edição ----------
const editSchema = baseExpense.partial();

expensesRouter.patch('/:id', requireRole(...ROLES), async (req, res) => {
  const p = editSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });

  const updated = await withTenant(req.ctx!, async (c) => {
    const before = (await c.query(
      `select ${SELECT_COLS} from public.expenses where id = $1 and school_id = $2 and deleted_at is null`,
      [req.params.id, req.ctx!.schoolId],
    )).rows[0];
    if (!before) return null;

    const next = {
      supplier_name: p.data.supplier_name ?? before.supplier_name,
      description: p.data.description ?? before.description,
      category: p.data.category ?? before.category,
      amount: p.data.amount ?? Number(before.amount),
      due_date: p.data.due_date ?? before.due_date,
    };

    const { rows } = await c.query(
      `update public.expenses set
         supplier_name = $1, description = $2, category = $3,
         amount = $4, due_date = $5, updated_at = now()
       where id = $6 and school_id = $7
       returning ${SELECT_COLS}`,
      [
        next.supplier_name,
        next.description,
        next.category,
        next.amount,
        next.due_date,
        req.params.id,
        req.ctx!.schoolId,
      ],
    );
    await logAudit(c, {
      schoolId: req.ctx!.schoolId,
      expenseId: req.params.id,
      action: 'update',
      actorId: req.ctx!.profileId,
      actorRole: req.ctx!.role,
      before,
      after: rows[0],
    });
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found', message: 'Despesa não encontrada' });
  res.json({ ok: true, data: updated });
});

// ---------- Marcar como pago ----------
expensesRouter.patch('/:id/pay', requireRole(...ROLES), async (req, res) => {
  const updated = await withTenant(req.ctx!, async (c) => {
    const before = (await c.query(
      `select ${SELECT_COLS} from public.expenses where id = $1 and school_id = $2 and deleted_at is null`,
      [req.params.id, req.ctx!.schoolId],
    )).rows[0];
    if (!before) return null;
    const { rows } = await c.query(
      `update public.expenses
          set status = 'paid', paid_at = now(), updated_at = now()
        where id = $1 and school_id = $2
        returning ${SELECT_COLS}`,
      [req.params.id, req.ctx!.schoolId],
    );
    await logAudit(c, {
      schoolId: req.ctx!.schoolId,
      expenseId: req.params.id,
      action: 'pay',
      actorId: req.ctx!.profileId,
      actorRole: req.ctx!.role,
      before,
      after: rows[0],
    });
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found', message: 'Despesa não encontrada' });
  res.json({ ok: true, data: updated });
});

// ---------- Desfazer pagamento ----------
expensesRouter.patch('/:id/unpay', requireRole(...ROLES), async (req, res) => {
  const updated = await withTenant(req.ctx!, async (c) => {
    const before = (await c.query(
      `select ${SELECT_COLS} from public.expenses where id = $1 and school_id = $2 and deleted_at is null`,
      [req.params.id, req.ctx!.schoolId],
    )).rows[0];
    if (!before) return null;
    const { rows } = await c.query(
      `update public.expenses
          set status = 'pending', paid_at = null, updated_at = now()
        where id = $1 and school_id = $2
        returning ${SELECT_COLS}`,
      [req.params.id, req.ctx!.schoolId],
    );
    await logAudit(c, {
      schoolId: req.ctx!.schoolId,
      expenseId: req.params.id,
      action: 'unpay',
      actorId: req.ctx!.profileId,
      actorRole: req.ctx!.role,
      before,
      after: rows[0],
    });
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found', message: 'Despesa não encontrada' });
  res.json({ ok: true, data: updated });
});

// ---------- Excluir (soft delete → vai para a lixeira) ----------
expensesRouter.delete('/:id', requireRole(...ROLES), async (req, res) => {
  const ok = await withTenant(req.ctx!, async (c) => {
    // Também executa a limpeza automática da lixeira (>60 dias).
    await c.query(
      `delete from public.expenses
        where school_id = $1
          and deleted_at is not null
          and deleted_at < now() - interval '${TRASH_TTL_DAYS} days'`,
      [req.ctx!.schoolId],
    );

    const before = (await c.query(
      `select ${SELECT_COLS} from public.expenses where id = $1 and school_id = $2 and deleted_at is null`,
      [req.params.id, req.ctx!.schoolId],
    )).rows[0];
    if (!before) return false;
    const { rows } = await c.query(
      `update public.expenses
          set deleted_at = now(), deleted_by = $3, updated_at = now()
        where id = $1 and school_id = $2
        returning ${SELECT_COLS}`,
      [req.params.id, req.ctx!.schoolId, req.ctx!.profileId],
    );
    await logAudit(c, {
      schoolId: req.ctx!.schoolId,
      expenseId: req.params.id,
      action: 'delete',
      actorId: req.ctx!.profileId,
      actorRole: req.ctx!.role,
      before,
      after: rows[0],
    });
    return true;
  });
  if (!ok) return res.status(404).json({ code: 'not_found', message: 'Despesa não encontrada' });
  res.status(204).end();
});

// ---------- Restaurar da lixeira ----------
expensesRouter.post('/:id/restore', requireRole(...ROLES), async (req, res) => {
  const updated = await withTenant(req.ctx!, async (c) => {
    const before = (await c.query(
      `select ${SELECT_COLS} from public.expenses where id = $1 and school_id = $2 and deleted_at is not null`,
      [req.params.id, req.ctx!.schoolId],
    )).rows[0];
    if (!before) return null;
    const { rows } = await c.query(
      `update public.expenses
          set deleted_at = null, deleted_by = null, updated_at = now()
        where id = $1 and school_id = $2
        returning ${SELECT_COLS}`,
      [req.params.id, req.ctx!.schoolId],
    );
    await logAudit(c, {
      schoolId: req.ctx!.schoolId,
      expenseId: req.params.id,
      action: 'restore',
      actorId: req.ctx!.profileId,
      actorRole: req.ctx!.role,
      before,
      after: rows[0],
    });
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found', message: 'Item não encontrado na lixeira' });
  res.json({ ok: true, data: updated });
});

// ---------- Excluir definitivamente (purge manual) ----------
expensesRouter.delete('/:id/purge', requireRole(...ROLES), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `delete from public.expenses where id = $1 and school_id = $2 and deleted_at is not null`,
      [req.params.id, req.ctx!.schoolId],
    );
    await logAudit(c, {
      schoolId: req.ctx!.schoolId,
      expenseId: req.params.id,
      action: 'purge',
      actorId: req.ctx!.profileId,
      actorRole: req.ctx!.role,
    });
  });
  res.status(204).end();
});

// ---------- Log de auditoria ----------
expensesRouter.get('/audit', requireRole(...ROLES), async (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  const expenseId = typeof req.query.expense_id === 'string' ? req.query.expense_id : undefined;

  const data = await withTenant(req.ctx!, async (c) => {
    const params: any[] = [req.ctx!.schoolId];
    let where = 'l.school_id = $1';
    if (from) { params.push(from); where += ` and l.created_at >= $${params.length}`; }
    if (to) { params.push(to); where += ` and l.created_at <= ($${params.length}::date + interval '1 day')`; }
    if (action) { params.push(action); where += ` and l.action = $${params.length}`; }
    if (expenseId) { params.push(expenseId); where += ` and l.expense_id = $${params.length}`; }
    const { rows } = await c.query(
      `select l.id, l.expense_id, l.action, l.actor_role, l.before, l.after, l.created_at,
              p.name as actor_name
         from public.expense_audit_log l
         left join public.profiles p on p.id = l.actor_id
        where ${where}
        order by l.created_at desc
        limit 500`,
      params,
    );
    return rows;
  });
  res.json({ ok: true, data });
});
