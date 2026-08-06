import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { dateSchema } from '../../lib/validation';

export const lessonPlansRouter = Router();
lessonPlansRouter.use(requireAuth);

/** Quem revisa: coordenação e direção (decidido com o usuário em 05/08/2026). */
const REVIEWERS = ['coordinator', 'school_admin', 'superadmin'];
const isReviewer = (role: string) => REVIEWERS.includes(role);

const daySchema = z.object({
  weekday: z.number().int().min(1).max(5),
  content: z.string().optional(),
  activity: z.string().optional(),
  homework: z.string().optional(),
});

const planSchema = z.object({
  class_id: z.string().uuid(),
  subject_id: z.string().uuid().nullable().optional(),
  week_start: dateSchema,
  objectives: z.string().optional(),
  contents: z.string().optional(),
  methodology: z.string().optional(),
  resources: z.string().optional(),
  evaluation: z.string().optional(),
  notes: z.string().optional(),
  days: z.array(daySchema).max(5).optional(),
});

/** Campos do bloco semanal, na ordem usada nos INSERT/UPDATE. */
const WEEK_FIELDS = ['objectives', 'contents', 'methodology', 'resources', 'evaluation', 'notes'] as const;

/**
 * Colunas de data como `date` chegam do pg como ISO completo; o app inteiro
 * compara "YYYY-MM-DD", então todo select usa to_char.
 */
const PLAN_SELECT = `
  select lp.id, lp.class_id, lp.subject_id, lp.teacher_id, lp.status,
         to_char(lp.week_start, 'YYYY-MM-DD') as week_start,
         lp.objectives, lp.contents, lp.methodology, lp.resources,
         lp.evaluation, lp.notes,
         lp.submitted_at, lp.reviewed_at, lp.created_at, lp.updated_at,
         cl.name  as class_name,
         s.name   as subject_name,
         t.name   as teacher_name,
         rv.name  as reviewer_name
    from public.lesson_plans lp
    join public.classes  cl on cl.id = lp.class_id
    join public.teachers t  on t.id  = lp.teacher_id
    left join public.subjects s  on s.id  = lp.subject_id
    left join public.profiles rv on rv.id = lp.reviewed_by`;

/** Id do registro de professor do usuário logado (null se não for professor). */
async function myTeacherId(c: any, ctx: any): Promise<string | null> {
  const { rows } = await c.query(
    `select id from public.teachers where user_id=$1 and school_id=$2 limit 1`,
    [ctx.profileId, ctx.schoolId],
  );
  return rows[0]?.id ?? null;
}

/** Normaliza qualquer data para a segunda-feira da sua semana (ISO). */
function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // domingo = 7
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

// ── GET / — lista. Professor vê só os próprios; revisor vê os da escola. ──
lessonPlansRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const params: unknown[] = [req.ctx!.schoolId];
    let filter = '';

    if (!isReviewer(req.ctx!.role)) {
      const teacherId = await myTeacherId(c, req.ctx!);
      if (!teacherId) return [];
      params.push(teacherId);
      filter += ` and lp.teacher_id = $${params.length}`;
    } else if (req.query.teacher_id) {
      params.push(req.query.teacher_id);
      filter += ` and lp.teacher_id = $${params.length}`;
    }

    if (req.query.status) {
      params.push(req.query.status);
      filter += ` and lp.status = $${params.length}`;
    }
    if (req.query.class_id) {
      params.push(req.query.class_id);
      filter += ` and lp.class_id = $${params.length}`;
    }
    if (req.query.week_start) {
      params.push(mondayOf(String(req.query.week_start)));
      filter += ` and lp.week_start = $${params.length}`;
    }

    const { rows } = await c.query(
      `${PLAN_SELECT} where lp.school_id = $1${filter}
        order by lp.week_start desc, cl.name asc`,
      params,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// ── GET /options — turmas e matérias que o professor leciona ──
lessonPlansRouter.get('/options', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const reviewer = isReviewer(req.ctx!.role);
    const params: unknown[] = [req.ctx!.schoolId];
    let filter = '';

    if (!reviewer) {
      const teacherId = await myTeacherId(c, req.ctx!);
      if (!teacherId) return { classes: [], teachers: [] };
      params.push(teacherId);
      // Regente da turma OU responsável por alguma matéria nela.
      filter = ` and (cl.teacher_id = $2 or cs.teacher_id = $2)`;
    }

    const { rows } = await c.query(
      `select cl.id as class_id, cl.name as class_name,
              cs.subject_id, s.name as subject_name
         from public.classes cl
         left join public.class_subjects cs on cs.class_id = cl.id
         left join public.subjects s on s.id = cs.subject_id
        where cl.school_id = $1 and cl.status = 'active'${filter}
        order by cl.name asc, s.name asc nulls first`,
      params,
    );

    // Agrupa matérias por turma para o seletor do formulário.
    const byClass = new Map<string, any>();
    for (const r of rows) {
      if (!byClass.has(r.class_id)) {
        byClass.set(r.class_id, { id: r.class_id, name: r.class_name, subjects: [] });
      }
      if (r.subject_id) {
        byClass.get(r.class_id).subjects.push({ id: r.subject_id, name: r.subject_name });
      }
    }

    let teachers: any[] = [];
    if (reviewer) {
      const t = await c.query(
        `select id, name from public.teachers
          where school_id=$1 and status='active' order by name asc`,
        [req.ctx!.schoolId],
      );
      teachers = t.rows;
    }
    return { classes: [...byClass.values()], teachers };
  });
  res.json({ ok: true, data });
});

// ── GET /themes?week_start= — temas da semana (todos leem) ──
lessonPlansRouter.get('/themes', async (req, res) => {
  const week = req.query.week_start ? mondayOf(String(req.query.week_start)) : mondayOf(new Date().toISOString().slice(0, 10));
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select th.id, th.title, th.description,
              to_char(th.week_start, 'YYYY-MM-DD') as week_start,
              th.created_at, p.name as created_by_name
         from public.lesson_plan_themes th
         left join public.profiles p on p.id = th.created_by
        where th.school_id = $1 and th.week_start = $2
        order by th.created_at asc`,
      [req.ctx!.schoolId, week],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// ── POST /themes — coordenação define o tema da semana ──
const themeSchema = z.object({
  week_start: dateSchema,
  title: z.string().min(2, 'Informe o título do tema'),
  description: z.string().optional(),
});

lessonPlansRouter.post('/themes', requireRole(...REVIEWERS), async (req, res) => {
  const p = themeSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });

  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.lesson_plan_themes (school_id, week_start, title, description, created_by)
       values ($1,$2,$3,$4,$5)
       on conflict do nothing
       returning id, title, description,
                 to_char(week_start,'YYYY-MM-DD') as week_start, created_at`,
      [req.ctx!.schoolId, mondayOf(p.data.week_start), p.data.title.trim(),
       p.data.description?.trim() || null, req.ctx!.profileId],
    );
    return rows[0] ?? null;
  });

  if (!created) return res.status(409).json({ code: 'conflict', message: 'Já existe um tema com esse título nesta semana.' });
  res.status(201).json({ ok: true, data: created });
});

// ── DELETE /themes/:id — remove o tema ──
lessonPlansRouter.delete('/themes/:id', requireRole(...REVIEWERS), async (req, res) => {
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `delete from public.lesson_plan_themes where id=$1 and school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
  });
  res.status(204).end();
});

// ── GET /:id — plano com dias e comentários ──
lessonPlansRouter.get('/:id', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `${PLAN_SELECT} where lp.id = $1 and lp.school_id = $2`,
      [req.params.id, req.ctx!.schoolId],
    );
    const plan = rows[0];
    if (!plan) return null;

    // Professor só acessa o próprio plano.
    if (!isReviewer(req.ctx!.role)) {
      const teacherId = await myTeacherId(c, req.ctx!);
      if (plan.teacher_id !== teacherId) return 'forbidden';
    }

    const days = await c.query(
      `select weekday, content, activity, homework
         from public.lesson_plan_days where plan_id=$1 order by weekday`,
      [plan.id],
    );
    // author_role diferencia visualmente professor de coordenação na thread.
    const comments = await c.query(
      `select cm.id, cm.body, cm.created_at, p.name as author_name, p.role as author_role
         from public.lesson_plan_comments cm
         join public.profiles p on p.id = cm.author_id
        where cm.plan_id=$1 order by cm.created_at asc`,
      [plan.id],
    );
    return { ...plan, days: days.rows, comments: comments.rows };
  });

  if (data === 'forbidden') return res.status(403).json({ code: 'forbidden', message: 'Plano de outro professor.' });
  if (!data) return res.status(404).json({ code: 'not_found', message: 'Plano não encontrado.' });
  res.json({ ok: true, data });
});

/** Grava os dias do plano (substitui os existentes). */
async function upsertDays(c: any, schoolId: string, planId: string, days: any[] = []) {
  await c.query(`delete from public.lesson_plan_days where plan_id=$1`, [planId]);
  for (const d of days) {
    if (!d.content && !d.activity && !d.homework) continue; // não grava dia vazio
    await c.query(
      `insert into public.lesson_plan_days (school_id, plan_id, weekday, content, activity, homework)
       values ($1,$2,$3,$4,$5,$6)`,
      [schoolId, planId, d.weekday, d.content ?? null, d.activity ?? null, d.homework ?? null],
    );
  }
}

// ── POST / — cria o plano (professor) ──
lessonPlansRouter.post('/', async (req, res) => {
  const p = planSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });

  const out = await withTenant(req.ctx!, async (c) => {
    let teacherId = await myTeacherId(c, req.ctx!);
    // Coordenação/direção pode lançar em nome de um professor.
    if (isReviewer(req.ctx!.role) && req.body?.teacher_id) teacherId = req.body.teacher_id;
    if (!teacherId) return 'no_teacher';

    const week = mondayOf(p.data.week_start);
    const { rows } = await c.query(
      `insert into public.lesson_plans
         (school_id, class_id, subject_id, teacher_id, week_start,
          objectives, contents, methodology, resources, evaluation, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict do nothing
       returning id`,
      [req.ctx!.schoolId, p.data.class_id, p.data.subject_id ?? null, teacherId, week,
       ...WEEK_FIELDS.map((f) => (p.data as any)[f] ?? null)],
    );
    if (!rows[0]) return 'duplicate';

    await upsertDays(c, req.ctx!.schoolId!,rows[0].id, p.data.days);
    return rows[0].id;
  });

  if (out === 'no_teacher') {
    return res.status(400).json({ code: 'validation', message: 'Seu usuário não está vinculado a um professor.' });
  }
  if (out === 'duplicate') {
    return res.status(409).json({ code: 'conflict', message: 'Já existe um plano para esta turma, matéria e semana.' });
  }
  res.status(201).json({ ok: true, data: { id: out } });
});

// ── PUT /:id — edita (dono, enquanto não aprovado) ──
lessonPlansRouter.put('/:id', async (req, res) => {
  const p = planSchema.partial({ class_id: true, week_start: true }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });

  const out = await withTenant(req.ctx!, async (c) => {
    const cur = await c.query(
      `select teacher_id, status from public.lesson_plans where id=$1 and school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
    const plan = cur.rows[0];
    if (!plan) return 'not_found';

    if (!isReviewer(req.ctx!.role)) {
      const teacherId = await myTeacherId(c, req.ctx!);
      if (plan.teacher_id !== teacherId) return 'forbidden';
      // Aprovado é definitivo para o professor; só a coordenação reabre.
      if (plan.status === 'approved') return 'locked';
    }

    await c.query(
      `update public.lesson_plans
          set objectives=$1, contents=$2, methodology=$3, resources=$4,
              evaluation=$5, notes=$6, updated_at=now()
        where id=$7 and school_id=$8`,
      [...WEEK_FIELDS.map((f) => (p.data as any)[f] ?? null), req.params.id, req.ctx!.schoolId],
    );
    await upsertDays(c, req.ctx!.schoolId!,req.params.id, p.data.days);
    return 'ok';
  });

  if (out === 'not_found') return res.status(404).json({ code: 'not_found' });
  if (out === 'forbidden') return res.status(403).json({ code: 'forbidden', message: 'Plano de outro professor.' });
  if (out === 'locked') return res.status(409).json({ code: 'conflict', message: 'Plano aprovado não pode ser editado.' });
  res.json({ ok: true });
});

// ── POST /:id/submit — envia para revisão ──
lessonPlansRouter.post('/:id/submit', async (req, res) => {
  const out = await withTenant(req.ctx!, async (c) => {
    const cur = await c.query(
      `select teacher_id, status from public.lesson_plans where id=$1 and school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
    const plan = cur.rows[0];
    if (!plan) return 'not_found';
    if (!isReviewer(req.ctx!.role)) {
      const teacherId = await myTeacherId(c, req.ctx!);
      if (plan.teacher_id !== teacherId) return 'forbidden';
    }
    if (plan.status === 'approved') return 'locked';

    await c.query(
      `update public.lesson_plans
          set status='submitted', submitted_at=now(), updated_at=now()
        where id=$1 and school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
    return 'ok';
  });

  if (out === 'not_found') return res.status(404).json({ code: 'not_found' });
  if (out === 'forbidden') return res.status(403).json({ code: 'forbidden' });
  if (out === 'locked') return res.status(409).json({ code: 'conflict', message: 'Plano já aprovado.' });
  res.json({ ok: true });
});

// ── PATCH /:id/review — coordenação aprova ou pede ajuste ──
lessonPlansRouter.patch('/:id/review', requireRole(...REVIEWERS), async (req, res) => {
  const decision = req.body?.decision;
  if (!['approve', 'request_changes'].includes(decision)) {
    return res.status(400).json({ code: 'validation', message: 'decision deve ser approve|request_changes' });
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (decision === 'request_changes' && !note) {
    return res.status(400).json({ code: 'validation', message: 'Descreva o ajuste solicitado.' });
  }

  const out = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `update public.lesson_plans
          set status=$1, reviewed_by=$2, reviewed_at=now(), updated_at=now()
        where id=$3 and school_id=$4
        returning id, status`,
      [decision === 'approve' ? 'approved' : 'changes_requested',
       req.ctx!.profileId, req.params.id, req.ctx!.schoolId],
    );
    if (!rows[0]) return null;
    // O parecer vira comentário para preservar o histórico da conversa.
    if (note) {
      await c.query(
        `insert into public.lesson_plan_comments (school_id, plan_id, author_id, body)
         values ($1,$2,$3,$4)`,
        [req.ctx!.schoolId, req.params.id, req.ctx!.profileId, note],
      );
    }
    return rows[0];
  });

  if (!out) return res.status(404).json({ code: 'not_found' });
  res.json({ ok: true, data: out });
});

// ── POST /:id/comments — comenta (professor dono ou revisor) ──
lessonPlansRouter.post('/:id/comments', async (req, res) => {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ code: 'validation', message: 'Escreva o comentário.' });

  const out = await withTenant(req.ctx!, async (c) => {
    const cur = await c.query(
      `select teacher_id from public.lesson_plans where id=$1 and school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
    if (!cur.rows[0]) return 'not_found';
    if (!isReviewer(req.ctx!.role)) {
      const teacherId = await myTeacherId(c, req.ctx!);
      if (cur.rows[0].teacher_id !== teacherId) return 'forbidden';
    }
    const { rows } = await c.query(
      `insert into public.lesson_plan_comments (school_id, plan_id, author_id, body)
       values ($1,$2,$3,$4)
       returning id, body, created_at,
                 (select name from public.profiles where id = $3) as author_name`,
      [req.ctx!.schoolId, req.params.id, req.ctx!.profileId, body],
    );
    // O papel vem do contexto: quem acabou de comentar é o próprio usuário.
    return { ...rows[0], author_role: req.ctx!.role };
  });

  if (out === 'not_found') return res.status(404).json({ code: 'not_found' });
  if (out === 'forbidden') return res.status(403).json({ code: 'forbidden' });
  res.status(201).json({ ok: true, data: out });
});
