import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { signUpGuardian } from '../../lib/authSignup';
import { cpfSchema, initialPassword, toStoredPassword } from '../../lib/validation';

export const staffRouter = Router();

const staffSchema = z.object({
  name: z.string().min(2),
  cpf: cpfSchema,
  email: z.string().email(),
  phone: z.string().optional(),
  role_type: z.enum(['school_admin', 'financial', 'teacher', 'coordinator']),
  subject_teaches: z.string().optional(),
  position: z.string().optional(),
  admission_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contract_type: z.enum(['clt', 'pj', 'estagio', 'temporario']).optional(),
  weekly_hours: z.number().min(0).max(80).optional(),
  timeclock_enabled: z.boolean().optional(),
});

const staffUpdateSchema = staffSchema.partial().extend({
  name: z.string().min(2),
});

staffRouter.use(requireAuth);

staffRouter.get('/', requireRole('school_admin', 'financial', 'teacher', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const isAdmin = ['school_admin', 'superadmin', 'financial'].includes(req.ctx!.role);
    const cpfCol = isAdmin ? 'cpf' : "left(cpf,3) || '*****' || right(cpf,2) as cpf";
    const { rows } = await c.query(
      `select id, name, email, phone, ${cpfCol}, registration_number, role_type, subject_teaches,
              position, admission_date::text as admission_date, contract_type, weekly_hours::float8 as weekly_hours,
              coalesce(timeclock_enabled, true) as timeclock_enabled,
              status, created_at, user_id
         from public.teachers
        where school_id = $1
        order by name asc`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

staffRouter.post('/', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  }
  const s = parsed.data;

  try {
    const result = await withTenant(req.ctx!, async (c) => {
      // matrícula F global
      const matRow = await c.query(`select public.next_staff_matricula() as matricula`);
      const matricula: string = matRow.rows[0].matricula;

      // Senha inicial = temporária aleatória (anote e repasse ao funcionário).
      // Login é feito pela matrícula. Guarda-se a versão de 8 chars no provedor.
      const visiblePassword = initialPassword();
      const authResult = await signUpGuardian({
        email: s.email,
        password: toStoredPassword(visiblePassword),
        name: s.name,
      });

      // criar profile (role = role_type) com flag de troca de senha obrigatória
      const profileRow = await c.query(
        `insert into public.profiles (auth_user_id, school_id, name, email, phone, role, cpf, password_change_required)
         values ($1, $2, $3, $4, $5, $6, $7, true)
         returning id`,
        [authResult.authUserId, req.ctx!.schoolId, s.name, s.email, s.phone ?? null,
         s.role_type, s.cpf],
      );
      const profileId = profileRow.rows[0].id;

      // criar teachers (staff)
      const tRow = await c.query(
        `insert into public.teachers
           (school_id, user_id, name, email, phone, cpf, registration_number, role_type, subject_teaches,
            position, admission_date, contract_type, weekly_hours, timeclock_enabled)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         returning id, user_id, name, email, phone, cpf, registration_number, role_type, subject_teaches,
                   position, admission_date::text as admission_date, contract_type, weekly_hours::float8 as weekly_hours,
                   timeclock_enabled, status, created_at`,
        [req.ctx!.schoolId, profileId, s.name, s.email, s.phone ?? null, s.cpf,
         matricula, s.role_type, s.subject_teaches ?? null,
         s.position ?? null, s.admission_date ?? null, s.contract_type ?? null, s.weekly_hours ?? null,
         s.timeclock_enabled ?? true],
      );

      return {
        ...tRow.rows[0],
        login_matricula: matricula,
        initial_password: visiblePassword,
        login_password_hint: 'Login: matrícula • Senha inicial: temporária gerada automaticamente (anote e repasse ao funcionário). Troca obrigatória no 1º acesso.',
      };
    });
    res.status(201).json({ ok: true, data: result });
  } catch (err: any) {
    console.error('[staff.create] erro:', err?.message ?? err);
    res.status(err?.http ?? 500).json({
      code: err?.code ?? 'create_failed',
      message: err?.message ?? 'Falha ao criar funcionário',
    });
  }
});

staffRouter.put('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const parsed = staffUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
  }
  const s = parsed.data;
  const updated = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `update public.teachers set
          name=coalesce($1,name),
          email=coalesce($2,email),
          phone=coalesce($3,phone),
          cpf=coalesce($4,cpf),
          role_type=coalesce($5,role_type),
          subject_teaches=coalesce($6,subject_teaches),
          position=coalesce($9,position),
          admission_date=coalesce($10,admission_date),
          contract_type=coalesce($11,contract_type),
          weekly_hours=coalesce($12,weekly_hours),
          timeclock_enabled=coalesce($13,timeclock_enabled)
        where id=$7 and school_id=$8
        returning id, name, email, phone, cpf, role_type, subject_teaches,
                  position, admission_date::text as admission_date, contract_type, weekly_hours::float8 as weekly_hours,
                  timeclock_enabled, status, registration_number, user_id`,
      [s.name ?? null, s.email ?? null, s.phone ?? null, s.cpf ?? null,
       s.role_type ?? null, s.subject_teaches ?? null, req.params.id, req.ctx!.schoolId,
       s.position ?? null, s.admission_date ?? null, s.contract_type ?? null, s.weekly_hours ?? null,
       s.timeclock_enabled ?? null],
    );
    if (rows[0]?.user_id) {
      await c.query(
        `update public.profiles set
            name=coalesce($1,name), email=coalesce($2,email),
            phone=coalesce($3,phone), cpf=coalesce($4,cpf),
            role=coalesce($5,role)
          where id=$6`,
        [s.name ?? null, s.email ?? null, s.phone ?? null, s.cpf ?? null,
         s.role_type ?? null, rows[0].user_id],
      );
    }
    return rows[0];
  });
  if (!updated) return res.status(404).json({ code: 'not_found' });
  res.json({ ok: true, data: updated });
});

staffRouter.delete('/:id', requireRole('school_admin', 'superadmin'), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `update public.teachers set status = 'inactive' where id = $1 and school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.status(204).end();
});
