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

// GET /api/saas/revenue — receita do SaaS (MRR, ARR, série, por plano, últimos pagamentos).
saasRouter.get('/revenue', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const [mrr, month, series, byPlan, recent] = await Promise.all([
      c.query(
        `select coalesce(sum(p.monthly_price),0)::float8 as mrr, count(*)::int as active_count
           from public.schools s join public.plans p on p.id = s.plan_id
          where s.subscription_status = 'active'`,
      ),
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
        `select coalesce(pl.name,'Sem plano') as label, coalesce(sum(pm.gross_amount),0)::float8 as value
           from public.payments pm
           join public.schools s on s.id = pm.school_id
           left join public.plans pl on pl.id = s.plan_id
          where pm.subscription_id is not null and pm.status='confirmed'
          group by 1 order by value desc`,
      ),
      c.query(
        `select pm.id, s.name as school_name, pm.gross_amount::float8 as amount, pm.paid_at, pm.status
           from public.payments pm join public.schools s on s.id = pm.school_id
          where pm.subscription_id is not null
          order by pm.paid_at desc nulls last limit 10`,
      ),
    ]);
    const mrrVal = Number(mrr.rows[0].mrr);
    const activeCount = mrr.rows[0].active_count || 0;
    const thisMonth = Number(month.rows[0].this_month);
    const prevMonth = Number(month.rows[0].prev_month);
    return {
      mrr: mrrVal,
      arr: mrrVal * 12,
      active_count: activeCount,
      avg_ticket: activeCount ? mrrVal / activeCount : 0,
      revenue_month: thisMonth,
      revenue_delta_pct: prevMonth > 0 ? ((thisMonth - prevMonth) / prevMonth) * 100 : null,
      series: series.rows.map((r: any) => ({
        month: new Date(r.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
        revenue: Number(r.revenue),
      })),
      by_plan: byPlan.rows.map((r: any) => ({ label: r.label, value: Number(r.value) })),
      recent: recent.rows.map((r: any) => ({
        id: r.id, school_name: r.school_name, amount: Number(r.amount),
        paid_at: r.paid_at, status: r.status,
      })),
    };
  });
  res.json({ ok: true, data });
});

// GET /api/saas/payouts — repasses/saldos por escola (split ASAAS).
saasRouter.get('/payouts', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const [totals, schools] = await Promise.all([
      c.query(
        `select
           coalesce(sum(available_balance),0)::float8 as available,
           coalesce(sum(pending_balance),0)::float8 as pending,
           coalesce(sum(gross_received_total),0)::float8 as gross,
           coalesce(sum(platform_fees_total),0)::float8 as platform_fees,
           coalesce(sum(withdrawn_total),0)::float8 as withdrawn
         from public.school_balances`,
      ),
      c.query(
        `select s.id, s.name,
                coalesce(b.available_balance,0)::float8 as available_balance,
                coalesce(b.pending_balance,0)::float8 as pending_balance,
                coalesce(b.gross_received_total,0)::float8 as gross_received_total,
                coalesce(b.platform_fees_total,0)::float8 as platform_fees_total,
                coalesce(b.withdrawn_total,0)::float8 as withdrawn_total
           from public.schools s
           left join public.school_balances b on b.school_id = s.id
          order by coalesce(b.available_balance,0) desc`,
      ),
    ]);
    const t = totals.rows[0];
    return {
      totals: {
        available: Number(t.available), pending: Number(t.pending), gross: Number(t.gross),
        platform_fees: Number(t.platform_fees), withdrawn: Number(t.withdrawn),
      },
      schools: schools.rows.map((r: any) => ({
        id: r.id, name: r.name,
        available_balance: Number(r.available_balance),
        pending_balance: Number(r.pending_balance),
        gross_received_total: Number(r.gross_received_total),
        platform_fees_total: Number(r.platform_fees_total),
        withdrawn_total: Number(r.withdrawn_total),
      })),
    };
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

// -------------------------------------------------------------------------
// Configuração de planos (CRUD) — só superadmin.
// -------------------------------------------------------------------------

type PlanFields = {
  name: string; student_limit: number | null; monthly_price: number; annual_price: number;
  discount_percentage: number; is_public: boolean; is_pilot: boolean; features_json: string[];
};

function parsePlanBody(body: any): { error: string } | PlanFields {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (name.length < 2) return { error: 'Informe o nome do plano.' };
  const monthly = Number(body?.monthly_price);
  const annual = Number(body?.annual_price);
  const discount = Number(body?.discount_percentage ?? 0);
  if (!Number.isFinite(monthly) || monthly < 0) return { error: 'Preço mensal inválido.' };
  if (!Number.isFinite(annual) || annual < 0) return { error: 'Preço anual inválido.' };
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) return { error: 'Desconto inválido (0–100).' };
  const rawLimit = body?.student_limit;
  const student_limit = rawLimit === null || rawLimit === '' || rawLimit === undefined
    ? null : Math.max(0, Math.floor(Number(rawLimit)));
  if (student_limit !== null && !Number.isFinite(student_limit)) return { error: 'Limite de alunos inválido.' };
  const features_json = Array.isArray(body?.features_json)
    ? body.features_json.filter((f: any) => typeof f === 'string' && f.trim()).map((f: string) => f.trim()).slice(0, 30)
    : [];
  return {
    name, student_limit, monthly_price: monthly, annual_price: annual,
    discount_percentage: discount, is_public: Boolean(body?.is_public), is_pilot: Boolean(body?.is_pilot),
    features_json,
  };
}

// GET /api/saas/plans — todos os planos (inclui privados/piloto) + nº de escolas.
saasRouter.get('/plans', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select p.id, p.name, p.student_limit,
              p.monthly_price::float8 as monthly_price, p.annual_price::float8 as annual_price,
              p.discount_percentage::float8 as discount_percentage, p.is_public, p.is_pilot,
              p.features_json, p.created_at,
              (select count(*)::int from public.schools s where s.plan_id = p.id) as schools_count
         from public.plans p order by p.monthly_price asc`,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// POST /api/saas/plans — cria um plano.
saasRouter.post('/plans', async (req, res) => {
  const p = parsePlanBody(req.body);
  if ('error' in p) return res.status(400).json({ code: 'validation', message: p.error });
  const data = await withTenant(req.ctx!, async (c) => {
    const r = await c.query(
      `insert into public.plans (name, student_limit, monthly_price, annual_price, discount_percentage, is_public, is_pilot, features_json)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [p.name, p.student_limit, p.monthly_price, p.annual_price, p.discount_percentage, p.is_public, p.is_pilot, JSON.stringify(p.features_json)],
    );
    return r.rows[0];
  });
  res.status(201).json({ ok: true, data });
});

// PUT /api/saas/plans/:id — edita um plano.
saasRouter.put('/plans/:id', async (req, res) => {
  const p = parsePlanBody(req.body);
  if ('error' in p) return res.status(400).json({ code: 'validation', message: p.error });
  const data = await withTenant(req.ctx!, async (c) => {
    const r = await c.query(
      `update public.plans set name=$2, student_limit=$3, monthly_price=$4, annual_price=$5,
              discount_percentage=$6, is_public=$7, is_pilot=$8, features_json=$9, updated_at=now()
        where id=$1 returning id`,
      [req.params.id, p.name, p.student_limit, p.monthly_price, p.annual_price, p.discount_percentage, p.is_public, p.is_pilot, JSON.stringify(p.features_json)],
    );
    return r.rows[0] ?? null;
  });
  if (!data) return res.status(404).json({ code: 'not_found', message: 'Plano não encontrado.' });
  res.json({ ok: true, data });
});

// DELETE /api/saas/plans/:id — remove um plano (bloqueado se estiver em uso).
saasRouter.delete('/plans/:id', async (req, res) => {
  const result = await withTenant(req.ctx!, async (c) => {
    const used = await c.query(`select count(*)::int as n from public.schools where plan_id=$1`, [req.params.id]);
    if (used.rows[0].n > 0) return { error: 'in_use' as const, count: used.rows[0].n };
    const r = await c.query(`delete from public.plans where id=$1`, [req.params.id]);
    return { deleted: r.rowCount ?? 0 };
  });
  if ('error' in result) return res.status(409).json({ code: 'in_use', message: `Plano em uso por ${result.count} escola(s). Migre-as antes de excluir.` });
  if (!result.deleted) return res.status(404).json({ code: 'not_found', message: 'Plano não encontrado.' });
  res.json({ ok: true });
});

// GET /api/saas/audit-logs — auditoria de ações críticas (últimos 200 eventos).
saasRouter.get('/audit-logs', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.ip_address, a.created_at,
              s.name as school_name,
              coalesce(p.name, p.email, a.metadata->>'actor') as actor
         from public.audit_logs a
         left join public.schools s on s.id = a.school_id
         left join public.profiles p on p.id = a.user_id
        order by a.created_at desc limit 200`,
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /api/saas/transactions — todas as cobranças/pagamentos da plataforma.
saasRouter.get('/transactions', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const [totals, list] = await Promise.all([
      c.query(
        `select
           coalesce(sum(gross_amount) filter (where status='confirmed'),0)::float8 as confirmed_total,
           count(*) filter (where status='confirmed')::int as confirmed_count,
           count(*)::int as total_count
         from public.payments`,
      ),
      c.query(
        `select pm.id, pm.gross_amount::float8 as amount, pm.payment_method, pm.provider,
                pm.status, pm.paid_at, pm.created_at,
                case when pm.subscription_id is not null then 'assinatura' else 'mensalidade' end as kind,
                s.name as school_name
           from public.payments pm
           left join public.schools s on s.id = pm.school_id
          order by coalesce(pm.paid_at, pm.created_at) desc limit 200`,
      ),
    ]);
    const t = totals.rows[0];
    return {
      totals: { confirmed_total: Number(t.confirmed_total), confirmed_count: t.confirmed_count, total_count: t.total_count },
      rows: list.rows.map((r: any) => ({
        id: r.id, amount: Number(r.amount), payment_method: r.payment_method, provider: r.provider,
        status: r.status, paid_at: r.paid_at, created_at: r.created_at, kind: r.kind, school_name: r.school_name,
      })),
    };
  });
  res.json({ ok: true, data });
});

// GET /api/saas/subscriptions — assinaturas das escolas (plano, status, período).
saasRouter.get('/subscriptions', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select sub.id, sub.status, sub.amount::float8 as amount, sub.billing_cycle,
              sub.current_period_start, sub.current_period_end, sub.created_at,
              s.name as school_name, coalesce(p.name,'—') as plan
         from public.subscriptions sub
         left join public.schools s on s.id = sub.school_id
         left join public.plans p on p.id = sub.plan_id
        order by sub.created_at desc limit 200`,
    );
    return rows.map((r: any) => ({ ...r, amount: Number(r.amount) }));
  });
  res.json({ ok: true, data });
});
