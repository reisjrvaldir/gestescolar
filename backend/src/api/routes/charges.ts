import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { dateSchema } from '../../lib/validation';
import { generatePixForNewInvoices } from '../../lib/billing/studentInvoices';

export const chargesRouter = Router();
chargesRouter.use(requireAuth);

// GET /api/charges — lista as campanhas de cobrança avulsa da escola.
chargesRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select b.id, b.title, b.description, b.amount::float8 as amount, b.due_date, b.scope,
              b.class_id, cl.name as class_name, b.invoices_count, b.created_at,
              (select count(*)::int from public.invoices i where i.batch_id = b.id and i.status = 'paid') as paid_count
         from public.charge_batches b
         left join public.classes cl on cl.id = b.class_id
        where b.school_id = $1
        order by b.created_at desc`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

const adhocSchema = z.object({
  title: z.string().min(2, 'Informe um título para a cobrança'),
  description: z.string().optional(),
  amount: z.number().positive('Informe um valor maior que zero'),
  due_date: dateSchema,
  scope: z.enum(['all', 'class']),
  class_id: z.string().uuid().optional(),
}).refine((v) => v.scope !== 'class' || !!v.class_id, {
  message: 'Selecione a turma', path: ['class_id'],
});

// POST /api/charges — cria uma cobrança avulsa (festa, material, evento...)
// vinculada a todos os alunos ativos ou a uma turma específica. Gera uma
// fatura + cobrança PIX individual para cada aluno (visível ao responsável).
chargesRouter.post('/', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const p = adhocSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const { title, description, amount, due_date, scope, class_id } = p.data;

  const result = await withTenant(req.ctx!, async (c) => {
    if (scope === 'class') {
      const cls = await c.query(`select id from public.classes where id=$1 and school_id=$2`, [class_id, req.ctx!.schoolId]);
      if (cls.rows.length === 0) return { error: 'class_not_found' as const };
    }

    const batch = await c.query(
      `insert into public.charge_batches (school_id, title, description, amount, due_date, scope, class_id, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [req.ctx!.schoolId, title, description ?? null, amount, due_date, scope, class_id ?? null, req.ctx!.profileId],
    );
    const batchId = batch.rows[0].id;

    const filter = scope === 'class' ? ' and s.class_id = $2' : '';
    const params = scope === 'class' ? [req.ctx!.schoolId, class_id] : [req.ctx!.schoolId];
    const students = await c.query(
      `select s.id, s.name from public.students s
        where s.school_id = $1 and s.status = 'active' and s.guardian_id is not null${filter}`,
      params,
    );

    const referenceMonth = due_date.slice(0, 7);
    const invoiceIds: string[] = [];
    for (const st of students.rows) {
      const inv = await c.query(
        `insert into public.invoices
           (school_id, student_id, student_name, amount, due_date, status, kind, batch_id, reference_month)
         values ($1,$2,$3,$4,$5,'pending','avulsa',$6,$7)
         returning id`,
        [req.ctx!.schoolId, st.id, st.name, amount, due_date, batchId, referenceMonth],
      );
      invoiceIds.push(inv.rows[0].id);
    }

    await c.query(`update public.charge_batches set invoices_count=$1 where id=$2`, [invoiceIds.length, batchId]);

    return { batchId, invoiceIds, studentsCount: students.rows.length };
  });

  if ('error' in result) {
    return res.status(404).json({ code: result.error, message: 'Turma não encontrada' });
  }

  // Gera a cobrança PIX de cada fatura (fora da transação principal).
  if (result.invoiceIds.length > 0) {
    generatePixForNewInvoices(req.ctx!, result.invoiceIds).catch((err) =>
      console.error('[charges.create] falha ao gerar PIX das cobranças avulsas:', err?.message ?? err),
    );
  }

  res.status(201).json({
    ok: true,
    data: { batch_id: result.batchId, students_count: result.studentsCount, invoices_created: result.invoiceIds.length },
  });
});
