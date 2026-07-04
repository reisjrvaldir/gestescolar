import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const saasRouter = Router();
saasRouter.use(requireAuth, requireRole('superadmin'));

// Expressão de status derivado de uma escola (constante — sem entrada do usuário).
const DERIVED = `
  case
    when s.status = 'suspended' then 'suspensa'
    when s.subscription_status = 'canceled' then 'cancelada'
    when s.subscription_status = 'active' then 'ativa'
    when s.subscription_status = 'trialing' and (s.trial_ends_at is null or s.trial_ends_at > now()) then 'trial'
    else 'em_atraso'
  end`;

// GET /api/saas/dashboard — agregados REAIS de toda a plataforma.
// Superadmin abre a RLS (is_superadmin) e enxerga todas as escolas.
saasRouter.get('/dashboard', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const [
      metrics, users, revenue, revenueSeries, planDist, statusDist,
      recentSchools, overdueSchools, activities,
    ] = await Promise.all([
      c.query(
        `select
           count(*)::int as total_schools,
           count(*) filter (where created_at >= date_trunc('month', now()))::int as new_this_month,
           count(*) filter (where subscription_status='active'
             or (subscription_status='trialing' and (trial_ends_at is null or trial_ends_at > now())))::int as active_schools,
           count(*) filter (where subscription_status in ('past_due','canceled')
             or (subscription_status='trialing' and trial_ends_at < now()))::int as overdue_schools
         from public.schools`,
      ),
      c.query(`select count(*)::int as total from public.profiles where status='active'`),
      c.query(
        `select
           coalesce(sum(gross_amount) filter (where paid_at >= date_trunc('month', now())),0)::float8 as this_month,
           coalesce(sum(gross_amount) filter (where paid_at >= date_trunc('month', now()) - interval '1 month'
             and paid_at < date_trunc('month', now())),0)::float8 as prev_month
         from public.payments where subscription_id is not null and status='confirmed'`,
      ),
      c.query(
        `select d.month, coalesce(sum(pm.gross_amount),0)::float8 as revenue
           from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') d(month)
           left join public.payments pm on pm.subscription_id is not null and pm.status='confirmed'
             and date_trunc('month', pm.paid_at) = d.month
          group by d.month order by d.month`,
      ),
      c.query(
        `select coalesce(p.name,'Sem plano') as label, count(*)::int as value
           from public.schools s left join public.plans p on p.id = s.plan_id
          group by 1 order by value desc`,
      ),
      c.query(
        `select derived as label, count(*)::int as value
           from (select ${DERIVED} as derived from public.schools s) t
          group by 1`,
      ),
      c.query(
        `select s.id, s.name, coalesce(p.name,'—') as plan, s.created_at, ${DERIVED} as status
           from public.schools s left join public.plans p on p.id = s.plan_id
          order by s.created_at desc limit 6`,
      ),
      c.query(
        `select s.id, s.name, coalesce(p.name,'—') as plan,
                greatest(0, (current_date - coalesce(s.trial_ends_at::date, s.updated_at::date)))::int as days_late,
                coalesce(p.monthly_price,0)::float8 as amount
           from public.schools s left join public.plans p on p.id = s.plan_id
          where s.subscription_status in ('past_due','canceled')
             or (s.subscription_status='trialing' and s.trial_ends_at < now())
          order by days_late desc limit 8`,
      ),
      c.query(
        `select * from (
           (select 'school_created' as type, 'Nova escola cadastrada' as title, s.name as subtitle, s.created_at as at
              from public.schools s order by s.created_at desc limit 6)
           union all
           (select
              case when a.action like 'PAYMENT%' or a.action like 'SUBSCRIPTION%' then 'payment_received' else 'user_created' end as type,
              case when a.action like 'PAYMENT%' or a.action like 'SUBSCRIPTION%' then 'Pagamento recebido'
                   else replace(initcap(replace(a.action,'_',' ')),' ',' ') end as title,
              sc.name as subtitle, a.created_at as at
              from public.audit_logs a left join public.schools sc on sc.id = a.school_id
              order by a.created_at desc limit 6)
         ) t
         order by at desc nulls last limit 8`,
      ),
    ]);

    const m = metrics.rows[0];
    const thisMonth = Number(revenue.rows[0].this_month);
    const prevMonth = Number(revenue.rows[0].prev_month);
    const totalSchools = m.total_schools || 0;

    return {
      metrics: {
        total_schools: totalSchools,
        new_this_month: m.new_this_month,
        active_schools: m.active_schools,
        active_pct: totalSchools ? (m.active_schools / totalSchools) * 100 : 0,
        revenue_month: thisMonth,
        revenue_delta_pct: prevMonth > 0 ? ((thisMonth - prevMonth) / prevMonth) * 100 : null,
        overdue_schools: m.overdue_schools,
        overdue_pct: totalSchools ? (m.overdue_schools / totalSchools) * 100 : 0,
        active_users: users.rows[0].total,
      },
      revenue_series: revenueSeries.rows.map((r: any) => ({
        month: new Date(r.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
        revenue: Number(r.revenue),
      })),
      plan_distribution: planDist.rows,
      status_distribution: statusDist.rows,
      recent_schools: recentSchools.rows,
      overdue_schools: overdueSchools.rows.map((r: any) => ({ ...r, amount: Number(r.amount) })),
      activities: activities.rows,
    };
  });
  res.json({ ok: true, data });
});

// GET /api/saas/schools — lista completa de escolas (base para a tela "Todas as escolas").
saasRouter.get('/schools', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select s.id, s.name, s.cnpj, s.email, s.phone, s.created_at, s.trial_ends_at,
              s.subscription_status, s.status as school_status,
              coalesce(p.name,'—') as plan, ${DERIVED} as derived_status,
              (select count(*)::int from public.profiles pr where pr.school_id = s.id) as users_count,
              (select count(*)::int from public.students st where st.school_id = s.id and st.status='active') as students_count
         from public.schools s left join public.plans p on p.id = s.plan_id
        order by s.created_at desc`,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// -------------------------------------------------------------------------
// Ações críticas sobre escolas — cada uma registra em audit_logs (ator +
// data/hora + motivo). Só superadmin chega aqui (middleware acima).
// -------------------------------------------------------------------------

// POST /api/saas/schools/:id/extend — prorroga o acesso (dias OU data final).
saasRouter.post('/schools/:id/extend', async (req, res) => {
  const schoolId = String(req.params.id);
  const days = req.body?.days != null ? Number(req.body.days) : null;
  const until = typeof req.body?.until === 'string' ? req.body.until.trim() : '';
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return res.status(400).json({ code: 'reason_required', message: 'Informe o motivo da prorrogação.' });

  let newUntil: string | null = null;
  if (until) {
    const d = new Date(`${until}T23:59:59`);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ code: 'bad_date', message: 'Data final inválida.' });
    if (d.getTime() <= Date.now()) return res.status(400).json({ code: 'past_date', message: 'A data final deve ser futura.' });
    newUntil = d.toISOString();
  } else if (days != null) {
    if (!Number.isFinite(days) || days <= 0 || days > 3650) return res.status(400).json({ code: 'bad_days', message: 'Número de dias inválido.' });
  } else {
    return res.status(400).json({ code: 'missing_period', message: 'Informe a quantidade de dias ou uma data final.' });
  }

  const data = await withTenant(req.ctx!, async (c) => {
    const upd = await c.query(
      `update public.schools s set
         trial_ends_at = case when $2::timestamptz is not null then $2::timestamptz
                              else greatest(now(), coalesce(s.trial_ends_at, now())) + ($3::int * interval '1 day') end,
         subscription_status = case when s.subscription_status = 'active' then s.subscription_status else 'trialing' end,
         updated_at = now()
       where s.id = $1
       returning s.id, s.name, s.trial_ends_at, s.subscription_status, s.status as school_status`,
      [schoolId, newUntil, days ?? 0],
    );
    if (upd.rowCount === 0) return null;
    await c.query(
      `insert into public.audit_logs (school_id, user_id, action, entity_type, entity_id, metadata)
       values ($1,$2,'ACCESS_EXTENDED','school',$1,$3)`,
      [schoolId, req.ctx!.profileId, JSON.stringify({ reason, days: days ?? null, until: newUntil, actor: req.identity?.email ?? null })],
    );
    return upd.rows[0];
  });
  if (!data) return res.status(404).json({ code: 'not_found', message: 'Escola não encontrada.' });
  res.json({ ok: true, data });
});

// POST /api/saas/schools/:id/suspend — suspende a escola (bloqueia acesso).
saasRouter.post('/schools/:id/suspend', async (req, res) => {
  const schoolId = String(req.params.id);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return res.status(400).json({ code: 'reason_required', message: 'Informe o motivo da suspensão.' });

  const data = await withTenant(req.ctx!, async (c) => {
    const upd = await c.query(
      `update public.schools set status='suspended', updated_at=now() where id=$1
       returning id, name, status as school_status, subscription_status, trial_ends_at`,
      [schoolId],
    );
    if (upd.rowCount === 0) return null;
    await c.query(
      `insert into public.audit_logs (school_id, user_id, action, entity_type, entity_id, metadata)
       values ($1,$2,'SCHOOL_SUSPENDED','school',$1,$3)`,
      [schoolId, req.ctx!.profileId, JSON.stringify({ reason, actor: req.identity?.email ?? null })],
    );
    return upd.rows[0];
  });
  if (!data) return res.status(404).json({ code: 'not_found', message: 'Escola não encontrada.' });
  res.json({ ok: true, data });
});

// POST /api/saas/schools/:id/reactivate — reativa a escola (opcionalmente com novo trial).
saasRouter.post('/schools/:id/reactivate', async (req, res) => {
  const schoolId = String(req.params.id);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const raw = req.body?.trial_days != null ? Number(req.body.trial_days) : 7;
  const days = Number.isFinite(raw) && raw > 0 && raw <= 3650 ? Math.floor(raw) : 7;

  const data = await withTenant(req.ctx!, async (c) => {
    const upd = await c.query(
      `update public.schools s set
         status='active',
         subscription_status = case when s.subscription_status='active' then 'active' else 'trialing' end,
         trial_ends_at = case when s.subscription_status='active' then s.trial_ends_at
                              else greatest(coalesce(s.trial_ends_at, now()), now() + ($2::int * interval '1 day')) end,
         updated_at = now()
       where s.id=$1
       returning s.id, s.name, s.status as school_status, s.subscription_status, s.trial_ends_at`,
      [schoolId, days],
    );
    if (upd.rowCount === 0) return null;
    await c.query(
      `insert into public.audit_logs (school_id, user_id, action, entity_type, entity_id, metadata)
       values ($1,$2,'SCHOOL_REACTIVATED','school',$1,$3)`,
      [schoolId, req.ctx!.profileId, JSON.stringify({ reason: reason || null, trial_days: days, actor: req.identity?.email ?? null })],
    );
    return upd.rows[0];
  });
  if (!data) return res.status(404).json({ code: 'not_found', message: 'Escola não encontrada.' });
  res.json({ ok: true, data });
});
