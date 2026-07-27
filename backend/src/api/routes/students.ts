import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { signUpGuardian } from '../../lib/authSignup';
import { DEFAULT_GUARDIAN_PASSWORD, toStoredPassword } from '../../lib/validation';
import { insertMonthlyInvoices, insertEnrollmentInvoice, generatePixForNewInvoices, type FirstDueRule } from '../../lib/billing/studentInvoices';
import { validateBody } from '../../lib/validateBody';
import { studentCreateSchema, studentUpdateSchema } from '../../../../shared/schemas';

export const studentsRouter = Router();

studentsRouter.use(requireAuth);

studentsRouter.get('/', requireRole('school_admin', 'financial', 'teacher', 'superadmin'), async (req, res) => {
  const classId    = req.query.class_id as string | undefined;
  const statusFilter = req.query.status as string | undefined;
  const data = await withTenant(req.ctx!, async (c) => {
    const params: unknown[] = [req.ctx!.schoolId];
    let filter = '';
    if (classId) {
      params.push(classId);
      filter += ` and s.class_id = $${params.length}`;
    }
    if (statusFilter) {
      params.push(statusFilter);
      filter += ` and s.status = $${params.length}`;
    }
    // Dados pessoais sempre mascarados nas listagens — revelação via /personal-data/reveal
    const { rows } = await c.query(
      `select s.id, s.name, s.registration_number, s.status, s.class_id, s.guardian_id,
              '***.***.***-' || right(s.cpf, 2)                                           as cpf,
              case when s.rg    is null then null else '****-'    || right(s.rg, 2)   end as rg,
              s.birth_date::text as birth_date, s.father_name, s.mother_name,
              s.blood_type, s.naturality, s.photo_url,
              s.monthly_fee::float8 as monthly_fee, s.plan_id,
              s.created_at,
              cl.name as class_name,
              g.name as guardian_name,
              case when g.email  is null then null else left(g.email,1)  || '***@' || split_part(g.email,'@',2)              end as guardian_email,
              case when g.cpf    is null then null else '***.***.***-' || right(g.cpf,2)                                     end as guardian_cpf,
              case when g.phone  is null then null else '(**) ****-'  || right(g.phone,4)                                    end as guardian_phone,
              case when g.phone2 is null then null else '(**) ****-'  || right(g.phone2,4)                                   end as guardian_phone2
         from public.students s
         left join public.classes cl on cl.id = s.class_id
         left join public.guardians g on g.id = s.guardian_id
        where s.school_id = $1${filter}
        order by s.name asc`,
      params,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// POST /api/students — cria aluno + responsável + login (transacional)
studentsRouter.post('/', requireRole('school_admin', 'superadmin'), validateBody(studentCreateSchema), async (req, res) => {
  const s = req.body as import('../../../../shared/schemas').StudentCreateOutput;

  let authUserId: string | null = null;
  try {
    const result = await withTenant(req.ctx!, async (c) => {
      // 1) Buscar valores do plano (mensalidade + matrícula). Aplica desconto %
      //    igual em ambos (regra de negócio: desconto vale p/ matrícula e mensalidades).
      const planRow = await c.query(
        `select name, monthly_fee::numeric as monthly_fee, enrollment_fee::numeric as enrollment_fee,
                updated_at
           from public.school_plans where id=$1 and school_id=$2`,
        [s.plan_id, req.ctx!.schoolId],
      );
      if (planRow.rows.length === 0) {
        throw Object.assign(new Error('Plano não encontrado ou pertence a outra escola'), { http: 400, code: 'plan_not_found' });
      }
      const discountPct = Math.min(100, Math.max(0, Number(s.discount_percentage ?? 0)));
      const rawMonthly = planRow.rows[0].monthly_fee;
      const rawEnroll = planRow.rows[0].enrollment_fee;
      const baseMonthly = rawMonthly == null ? 0 : Number(rawMonthly);
      const baseEnroll = rawEnroll == null ? 0 : Number(rawEnroll);
      if (Number.isNaN(baseMonthly) || Number.isNaN(baseEnroll)) {
        throw Object.assign(new Error('Plano com valores inválidos'), { http: 400, code: 'invalid_plan_fee' });
      }
      const { applyDiscount } = await import('../../lib/billing/studentInvoices');
      const monthlyFee = applyDiscount(baseMonthly, discountPct);
      const enrollmentFee = applyDiscount(baseEnroll, discountPct);
      const planSnapshot = {
        name: String(planRow.rows[0].name),
        monthly_fee: baseMonthly,
        enrollment_fee: baseEnroll,
        version: planRow.rows[0].updated_at instanceof Date
          ? planRow.rows[0].updated_at.toISOString()
          : String(planRow.rows[0].updated_at),
      };
      const enrollMethod = (s.enrollment_payment_method ?? 'pix') as 'cash' | 'pix' | 'card';
      const firstDue = (s.first_due ?? '30') as FirstDueRule;
      console.log('[students.create] plano=', s.plan_id, 'monthly=', monthlyFee, 'matricula=', enrollmentFee, 'desconto%=', discountPct);

      // 2) Gerar matrícula global atômica
      const matRow = await c.query(`select public.next_matricula() as matricula`);
      const matricula: string = matRow.rows[0].matricula;

      // Login primário = e-mail do responsável (matrícula também funciona via publicAuth).
      // Senha inicial = padrão único da plataforma (troca obrigatória no 1º acesso).
      const visiblePassword = DEFAULT_GUARDIAN_PASSWORD;

      // 4) Criar usuário no Neon Auth (público — sign-up); guarda versão de 8 chars.
      const authResult = await signUpGuardian({
        email: s.guardian.email,
        password: toStoredPassword(visiblePassword),
        name: s.guardian.name,
      });
      authUserId = authResult.authUserId;

      // 5) Criar profile vinculado com flag de troca obrigatória
      const profileRow = await c.query(
        `insert into public.profiles (auth_user_id, school_id, name, email, phone, role, password_change_required)
         values ($1, $2, $3, $4, $5, 'guardian', true)
         returning id`,
        [authUserId, req.ctx!.schoolId, s.guardian.name, s.guardian.email, s.guardian.phone ?? null],
      );
      const profileId = profileRow.rows[0].id;

      // 6) Criar guardian
      const guardianRow = await c.query(
        `insert into public.guardians (school_id, user_id, name, email, phone, phone2, cpf, relationship)
         values ($1, $2, $3, $4, $5, $6, $7, 'responsavel')
         returning id`,
        [req.ctx!.schoolId, profileId, s.guardian.name, s.guardian.email,
         s.guardian.phone ?? null, s.guardian.phone2 ?? null, s.guardian.cpf],
      );
      const guardianId = guardianRow.rows[0].id;

      // 7) Criar aluno
      const studentRow = await c.query(
        `insert into public.students
           (school_id, name, cpf, rg, birth_date, blood_type, naturality, photo_url,
            registration_number, class_id, guardian_id,
            father_name, mother_name, monthly_fee, plan_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         returning id, name, registration_number, status, monthly_fee`,
        [req.ctx!.schoolId, s.name, s.cpf, s.rg ?? null, s.birth_date,
         s.blood_type ?? null, s.naturality ?? null, s.photo_url ?? null,
         matricula, s.class_id ?? null, guardianId,
         s.father_name, s.mother_name, monthlyFee, s.plan_id],
      );
      const student = studentRow.rows[0];

      // 8a) Fatura de MATRÍCULA (cobrança única). Dinheiro → já paga (offline).
      const enrollment = await insertEnrollmentInvoice(c, {
        schoolId: req.ctx!.schoolId!,
        studentId: student.id,
        studentName: student.name,
        amount: enrollmentFee,
        originalAmount: baseEnroll,
        discountPct,
        planId: s.plan_id,
        planSnapshot,
        paymentMethod: enrollMethod,
      });

      // 8b) Mensalidades do restante do ano, 1º vencimento conforme a regra.
      const monthlyResult = await insertMonthlyInvoices(c, {
        schoolId: req.ctx!.schoolId!,
        studentId: student.id,
        studentName: student.name,
        monthlyFee,
        originalMonthlyFee: baseMonthly,
        discountPct,
        planId: s.plan_id,
        planSnapshot,
        firstDueRule: firstDue,
      });

      // Cobranças PIX a gerar: mensalidades inseridas + matrícula (exceto se paga em dinheiro).
      const chargeableIds = [...monthlyResult.ids];
      if (enrollment && !enrollment.paid) chargeableIds.push(enrollment.id);

      return {
        ...student,
        monthly_fee: monthlyFee,
        enrollment_fee: enrollmentFee,
        enrollment_paid: enrollment?.paid ?? false,
        guardian_email: s.guardian.email,
        login_matricula: matricula,
        initial_password: visiblePassword,
        login_password_hint: 'Login: e-mail do responsável • Senha inicial padrão: Escola@2026 — troca obrigatória no 1º acesso.',
        invoice_ids: chargeableIds,
        invoices_skipped: monthlyResult.skipped,
      };
    });

    // Gera a cobrança PIX de cada mensalidade (fora da transação principal).
    if (result.invoice_ids?.length) {
      generatePixForNewInvoices(req.ctx!, result.invoice_ids).catch((err) =>
        console.error('[students.create] falha ao gerar PIX das mensalidades:', err?.message ?? err),
      );
    }

    res.status(201).json({ ok: true, data: result });
  } catch (err: any) {
    const status = err?.http ?? 500;
    const code = err?.code ?? 'create_failed';
    console.error('[students.create] erro:', err?.message ?? err);
    // Nota: se authUserId foi criado mas a transação falhou, o usuário fica órfão no Neon Auth.
    // Aceitável neste MVP — admin pode limpar manualmente.
    res.status(status).json({ code, message: err?.message ?? 'Falha ao criar aluno' });
  }
});

studentsRouter.put('/:id', requireRole('school_admin', 'superadmin'), validateBody(studentUpdateSchema), async (req, res) => {
  const s = req.body as import('../../../../shared/schemas').StudentUpdateOutput;
  const updated = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `update public.students set
          name=coalesce($1,name),
          cpf=coalesce($2,cpf),
          rg=coalesce($3,rg),
          birth_date=coalesce($4,birth_date),
          blood_type=coalesce($5,blood_type),
          naturality=coalesce($6,naturality),
          photo_url=coalesce($7,photo_url),
          father_name=coalesce($8,father_name),
          mother_name=coalesce($9,mother_name),
          class_id=coalesce($10,class_id),
          plan_id=coalesce($11,plan_id),
          monthly_fee=coalesce(
            (select monthly_fee from public.school_plans where id=$11 and school_id=$13),
            monthly_fee
          )
        where id=$12 and school_id=$13
        returning id, name, registration_number, status, class_id, monthly_fee, plan_id`,
      [s.name ?? null, s.cpf ?? null, s.rg ?? null, s.birth_date ?? null,
       s.blood_type ?? null, s.naturality ?? null, s.photo_url ?? null,
       s.father_name ?? null, s.mother_name ?? null,
       s.class_id ?? null, s.plan_id ?? null,
       req.params.id, req.ctx!.schoolId],
    );
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found' });
  res.json({ ok: true, data: updated });
});

studentsRouter.delete('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `update public.students set status = 'inactive' where id = $1 and school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.status(204).end();
});
