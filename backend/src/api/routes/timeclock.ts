import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const timeclockRouter = Router();
timeclockRouter.use(requireAuth);

// Fuso de referência da operação escolar (evita divergência UTC x local).
const TZ = 'America/Sao_Paulo';
// Tolerância (min) antes/depois da jornada para considerar batida "no horário".
const TOLERANCE_MIN = 15;

const ADMIN_ROLES = ['school_admin', 'superadmin'];

// ---------- Listagem: meus registros (filtro por mês no fuso da escola) ----------
timeclockRouter.get('/', async (req, res) => {
  const month = req.query.month as string | undefined; // YYYY-MM
  const data = await withTenant(req.ctx!, async (c) => {
    const params: unknown[] = [req.ctx!.schoolId, req.ctx!.profileId];
    let filter = '';
    if (month) {
      filter = ` and to_char(clock_in at time zone '${TZ}', 'YYYY-MM') = $3`;
      params.push(month);
    }
    const { rows } = await c.query(
      `select id, clock_in, clock_out, notes, created_at,
              approval_status, is_adjustment, justification
         from public.timeclock_entries
        where school_id = $1 and user_id = $2${filter}
        order by clock_in desc`,
      params,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// ---------- Ponto atualmente aberto (independe do mês) ----------
timeclockRouter.get('/open', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select id, clock_in from public.timeclock_entries
        where school_id=$1 and user_id=$2 and clock_out is null
        order by clock_in desc limit 1`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
    return rows[0] ?? null;
  });
  res.json({ ok: true, data });
});

// ---------- Listagem de toda a equipe (gestão) ----------
timeclockRouter.get('/all', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    if (!ADMIN_ROLES.includes(req.ctx!.role)) return [];
    const { rows } = await c.query(
      `select t.id, t.clock_in, t.clock_out, t.notes, t.approval_status, t.is_adjustment, p.name as user_name
         from public.timeclock_entries t
         join public.profiles p on p.id = t.user_id
        where t.school_id = $1
          and t.clock_in >= date_trunc('month', now() at time zone '${TZ}')
        order by t.clock_in desc`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// ---------- Espelho de ponto: total de horas por funcionário no período ----------
// GET /timeclock/report?from=YYYY-MM-DD&to=YYYY-MM-DD  (gestão)
// Consolida as batidas fechadas em total de horas + dias + registros em aberto.
timeclockRouter.get('/report', requireRole('school_admin', 'superadmin', 'financial'), async (req, res) => {
  const valid = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  // Janela padrão: 1º dia do mês corrente → hoje.
  const now = new Date();
  const defFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defTo = now.toISOString().slice(0, 10);
  const from = valid(req.query.from) ? req.query.from : defFrom;
  const to = valid(req.query.to) ? req.query.to : defTo;

  const data = await withTenant(req.ctx!, async (c) => {
    // Banco de horas = horas trabalhadas (aprovadas) − horas previstas na escala.
    // Horas previstas: para cada dia do período, soma a jornada do dia da semana.
    const { rows } = await c.query(
      `with days as (
         select gd::date as day, extract(dow from gd)::int as wd
           from generate_series($2::date, $3::date, interval '1 day') gd
       ),
       expected as (
         select ws.user_id,
                coalesce(sum(extract(epoch from (ws.end_time - ws.start_time)) / 3600.0), 0)::float8 as expected_hours
           from days
           join public.work_schedules ws on ws.school_id = $1 and ws.weekday = days.wd
          group by ws.user_id
       ),
       worked as (
         select t.user_id,
                coalesce(sum(extract(epoch from (t.clock_out - t.clock_in)) / 3600.0)
                         filter (where t.clock_out is not null and t.approval_status in ('auto','approved')), 0)::float8 as total_hours,
                count(*) filter (where t.clock_out is not null and t.approval_status in ('auto','approved'))::int as closed_entries,
                count(*) filter (where t.clock_out is null and t.approval_status in ('auto','approved'))::int as open_entries,
                count(*) filter (where t.approval_status = 'pending')::int as pending_adjustments,
                count(distinct (t.clock_in at time zone '${TZ}')::date)
                  filter (where t.approval_status in ('auto','approved'))::int as days_worked
           from public.timeclock_entries t
          where t.school_id = $1
            and (t.clock_in at time zone '${TZ}')::date between $2::date and $3::date
          group by t.user_id
       )
       select p.id as user_id, p.name as user_name, tc.role_type, tc.position,
              tc.weekly_hours::float8 as weekly_hours,
              coalesce(w.total_hours, 0)::float8 as total_hours,
              coalesce(w.closed_entries, 0)::int as closed_entries,
              coalesce(w.open_entries, 0)::int as open_entries,
              coalesce(w.pending_adjustments, 0)::int as pending_adjustments,
              coalesce(w.days_worked, 0)::int as days_worked,
              coalesce(e.expected_hours, 0)::float8 as expected_hours,
              (coalesce(w.total_hours, 0) - coalesce(e.expected_hours, 0))::float8 as balance_hours
         from public.teachers tc
         join public.profiles p on p.id = tc.user_id
         left join worked w on w.user_id = p.id
         left join expected e on e.user_id = p.id
        where tc.school_id = $1 and tc.status = 'active'
          and (w.user_id is not null or e.user_id is not null)
        order by p.name asc`,
      [req.ctx!.schoolId, from, to],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// ---------- Registrar entrada (professor/colaborador) ----------
// Regras:
//  - Gestor/admin NÃO registra ponto próprio (apenas gerencia/lança).
//  - Precisa ter JORNADA cadastrada para o dia da semana atual.
//  - Batida deve estar dentro do horário da jornada (+ tolerância).
timeclockRouter.post('/clock-in', async (req, res) => {
  if (ADMIN_ROLES.includes(req.ctx!.role)) {
    return res.status(403).json({
      code: 'admin_no_clock_in',
      message: 'A conta de gestão não registra ponto próprio. Use "Lançar ponto" para a equipe.',
    });
  }

  const result = await withTenant(req.ctx!, async (c) => {
    // Habilitado para bater ponto?
    const enabled = await c.query(
      `select coalesce(timeclock_enabled, true) as en from public.teachers
        where user_id=$1 and school_id=$2 limit 1`,
      [req.ctx!.profileId, req.ctx!.schoolId],
    );
    if (enabled.rows.length > 0 && enabled.rows[0].en === false) return { error: 'not_enabled' as const };

    // Já existe ponto aberto?
    const open = await c.query(
      `select id from public.timeclock_entries
        where school_id=$1 and user_id=$2 and clock_out is null limit 1`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
    if (open.rows.length > 0) return { error: 'already_clocked_in' as const };

    // Jornada do dia (0=dom ... 6=sáb) no fuso da escola.
    const sched = await c.query(
      `select start_time, end_time,
              (now() at time zone '${TZ}')::time as agora
         from public.work_schedules
        where school_id=$1 and user_id=$2
          and weekday = extract(dow from now() at time zone '${TZ}')::int
        limit 1`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
    if (sched.rows.length === 0) return { error: 'no_schedule' as const };

    // Dentro do horário (com tolerância)? Compara em minutos-do-dia com clamp,
    // evitando o "wrap" da meia-noite (ex.: 00:00 - 15min viraria 23:45).
    const within = await c.query(
      `with t as (
         select extract(epoch from (now() at time zone '${TZ}')::time) / 60 as cur,
                extract(epoch from ($1)::time) / 60 as st,
                extract(epoch from ($2)::time) / 60 as en
       )
       select cur >= greatest(0, st - ${TOLERANCE_MIN})
          and cur <= least(1439, en + ${TOLERANCE_MIN}) as ok
         from t`,
      [sched.rows[0].start_time, sched.rows[0].end_time],
    );
    if (!within.rows[0].ok) {
      return {
        error: 'outside_schedule' as const,
        start: sched.rows[0].start_time,
        end: sched.rows[0].end_time,
      };
    }

    const { rows } = await c.query(
      `insert into public.timeclock_entries (school_id, user_id, approval_status)
       values ($1, $2, 'auto') returning id, clock_in`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
    return rows[0];
  });

  if ('error' in result) {
    const map: Record<string, { http: number; message: string }> = {
      not_enabled: { http: 403, message: 'Você não está habilitado para bater ponto. Fale com a gestão da escola.' },
      already_clocked_in: { http: 409, message: 'Você já tem um ponto em aberto. Registre a saída primeiro.' },
      no_schedule: { http: 403, message: 'Você não possui jornada cadastrada para hoje. Fale com a gestão da escola.' },
      outside_schedule: {
        http: 422,
        message: `Fora do horário da sua jornada (${String((result as any).start).slice(0, 5)}–${String((result as any).end).slice(0, 5)}). Registre como esquecimento de ponto para aprovação da gestão.`,
      },
    };
    const m = map[result.error];
    return res.status(m.http).json({
      code: result.error, message: m.message,
      ...(result.error === 'outside_schedule' ? { start: String((result as any).start).slice(0, 5), end: String((result as any).end).slice(0, 5) } : {}),
    });
  }
  res.status(201).json({ ok: true, data: result });
});

// ---------- Registrar saída ----------
timeclockRouter.post('/clock-out', async (req, res) => {
  const updated = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `update public.timeclock_entries set clock_out = now()
        where school_id=$1 and user_id=$2 and clock_out is null
        returning id, clock_in, clock_out`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
    if (rows.length === 0) return { error: 'not_clocked_in' as const };
    return rows[0];
  });
  if ('error' in updated) {
    return res.status(409).json({ code: updated.error, message: 'Você não possui ponto em aberto.' });
  }
  res.json({ ok: true, data: updated });
});

// ---------- Lançar ponto manualmente (somente gestão) ----------
const manualSchema = z.object({
  user_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato AAAA-MM-DD'),
  clock_in: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de entrada HH:MM'),
  clock_out: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de saída HH:MM').optional(),
  notes: z.string().max(280).optional(),
});

timeclockRouter.post('/manual', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const p = manualSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const { user_id, date, clock_in, clock_out, notes } = p.data;

  const created = await withTenant(req.ctx!, async (c) => {
    // Confirma que o colaborador pertence à escola.
    const prof = await c.query(
      `select id from public.profiles where id=$1 and school_id=$2 limit 1`,
      [user_id, req.ctx!.schoolId],
    );
    if (prof.rows.length === 0) return { error: 'invalid_user' as const };

    const { rows } = await c.query(
      `insert into public.timeclock_entries (school_id, user_id, clock_in, clock_out, notes)
       values (
         $1, $2,
         ($3 || ' ' || $4)::timestamp at time zone '${TZ}',
         case when $5 <> '' then ($3 || ' ' || $5)::timestamp at time zone '${TZ}' else null end,
         nullif($6, '')
       )
       returning id, clock_in, clock_out, notes`,
      [req.ctx!.schoolId, user_id, date, clock_in, clock_out ?? '', notes ?? ''],
    );
    return rows[0];
  });

  if ('error' in created) {
    return res.status(400).json({ code: created.error, message: 'Colaborador inválido para esta escola.' });
  }
  res.status(201).json({ ok: true, data: created });
});

// ---------- Esquecimento de ponto (colaborador solicita; requer aprovação) ----------
// Registro fora da janela da jornada. Fica PENDENTE, não vence, aguarda o aceite
// da gestão e o fechamento da folha. Só conta no banco de horas após aprovado.
const adjustmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data AAAA-MM-DD'),
  clock_in: z.string().regex(/^\d{2}:\d{2}$/, 'Entrada HH:MM'),
  clock_out: z.string().regex(/^\d{2}:\d{2}$/, 'Saída HH:MM').optional(),
  justification: z.string().min(3, 'Descreva o motivo').max(280),
});

timeclockRouter.post('/adjustment', async (req, res) => {
  if (ADMIN_ROLES.includes(req.ctx!.role)) {
    return res.status(403).json({ code: 'admin_no_adjustment', message: 'Gestão lança ponto direto em "Lançar ponto".' });
  }
  const p = adjustmentSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const { date, clock_in, clock_out, justification } = p.data;

  const created = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `insert into public.timeclock_entries
         (school_id, user_id, clock_in, clock_out, justification, is_adjustment, approval_status)
       values (
         $1, $2,
         ($3 || ' ' || $4)::timestamp at time zone '${TZ}',
         case when $5 <> '' then ($3 || ' ' || $5)::timestamp at time zone '${TZ}' else null end,
         $6, true, 'pending'
       )
       returning id, clock_in, clock_out, justification, approval_status`,
      [req.ctx!.schoolId, req.ctx!.profileId, date, clock_in, clock_out ?? '', justification],
    );
    return rows[0];
  });
  res.status(201).json({ ok: true, data: created });
});

// ---------- Fila de aprovação de esquecimentos (gestão) ----------
timeclockRouter.get('/adjustments/pending', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select t.id, t.clock_in, t.clock_out, t.justification, p.name as user_name
         from public.timeclock_entries t
         join public.profiles p on p.id = t.user_id
        where t.school_id=$1 and t.is_adjustment = true and t.approval_status = 'pending'
        order by t.clock_in asc`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// ---------- Aprovar/recusar esquecimento (gestão) ----------
timeclockRouter.post('/adjustment/:id/review', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const action = req.body?.action === 'approve' ? 'approved' : req.body?.action === 'reject' ? 'rejected' : null;
  if (!action) return res.status(400).json({ code: 'validation', message: 'Ação inválida (approve|reject).' });

  const result = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `update public.timeclock_entries
          set approval_status=$3, reviewed_by=$4, reviewed_at=now()
        where id=$1 and school_id=$2 and is_adjustment = true and approval_status='pending'
        returning id, approval_status`,
      [req.params.id, req.ctx!.schoolId, action, req.ctx!.profileId],
    );
    if (rows.length === 0) return { error: 'not_found' as const };
    return rows[0];
  });
  if ('error' in result) return res.status(404).json({ code: 'not_found', message: 'Solicitação não encontrada ou já decidida.' });
  res.json({ ok: true, data: result });
});
