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
      `select id, clock_in, clock_out, notes, created_at
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
      `select t.id, t.clock_in, t.clock_out, t.notes, p.name as user_name
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
      `insert into public.timeclock_entries (school_id, user_id)
       values ($1, $2) returning id, clock_in`,
      [req.ctx!.schoolId, req.ctx!.profileId],
    );
    return rows[0];
  });

  if ('error' in result) {
    const map: Record<string, { http: number; message: string }> = {
      already_clocked_in: { http: 409, message: 'Você já tem um ponto em aberto. Registre a saída primeiro.' },
      no_schedule: { http: 403, message: 'Você não possui jornada cadastrada para hoje. Fale com a gestão da escola.' },
      outside_schedule: {
        http: 403,
        message: `Fora do horário da sua jornada (${String((result as any).start).slice(0, 5)}–${String((result as any).end).slice(0, 5)}). Solicite o registro à gestão.`,
      },
    };
    const m = map[result.error];
    return res.status(m.http).json({ code: result.error, message: m.message });
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
