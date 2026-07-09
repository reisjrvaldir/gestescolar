import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const financeRouter = Router();
// Dados financeiros da escola (previsão, despesas, inadimplência com nomes de
// famílias) são restritos à gestão/financeiro — nunca a responsável/professor.
financeRouter.use(requireAuth, requireRole('school_admin', 'financial', 'superadmin'));

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// GET /api/finance/summary?month=YYYY-MM — indicadores reais da Visão geral.
// "Previsão de receita do mês" = soma das faturas cujo mês de referência é o
// mês consultado (independente de já terem sido pagas), conforme a regra:
// cada mensalidade gerada entra na previsão do seu próprio mês.
financeRouter.get('/summary', async (req, res) => {
  const month = (req.query.month as string | undefined) ?? currentMonth();
  const data = await withTenant(req.ctx!, async (c) => {
    const [forecast, prevForecast, expenses, overdue, received, expensesPaid, byCategory] = await Promise.all([
      c.query(
        `select coalesce(sum(amount),0)::float8 as total
           from public.invoices
          where school_id=$1 and reference_month=$2 and status not in ('cancelled','refunded')`,
        [req.ctx!.schoolId, month],
      ),
      c.query(
        `select coalesce(sum(amount),0)::float8 as total
           from public.invoices
          where school_id=$1 and reference_month = to_char((($2 || '-01')::date - interval '1 month'), 'YYYY-MM')
            and status not in ('cancelled','refunded')`,
        [req.ctx!.schoolId, month],
      ),
      c.query(
        `select coalesce(sum(amount),0)::float8 as total
           from public.expenses
          where school_id=$1 and to_char(due_date,'YYYY-MM')=$2 and status <> 'cancelled'`,
        [req.ctx!.schoolId, month],
      ),
      c.query(
        `select coalesce(sum(amount),0)::float8 as total, count(*)::int as count
           from public.invoices
          where school_id=$1 and status='overdue'`,
        [req.ctx!.schoolId],
      ),
      // Recebido de fato no mês (faturas pagas) → base do saldo/resumo real.
      c.query(
        `select coalesce(sum(amount),0)::float8 as total
           from public.invoices
          where school_id=$1 and status='paid' and to_char(paid_at,'YYYY-MM')=$2`,
        [req.ctx!.schoolId, month],
      ),
      // Despesas efetivamente pagas no mês → "saiu" real.
      c.query(
        `select coalesce(sum(amount),0)::float8 as total
           from public.expenses
          where school_id=$1 and status='paid' and to_char(due_date,'YYYY-MM')=$2`,
        [req.ctx!.schoolId, month],
      ),
      // Despesas do mês por categoria (para o gráfico de gastos).
      c.query(
        `select coalesce(nullif(trim(category),''),'Outros') as category,
                coalesce(sum(amount),0)::float8 as total
           from public.expenses
          where school_id=$1 and to_char(due_date,'YYYY-MM')=$2 and status <> 'cancelled'
          group by 1 order by total desc`,
        [req.ctx!.schoolId, month],
      ),
    ]);

    const forecastMonth = forecast.rows[0].total;
    const prevForecastMonth = prevForecast.rows[0].total;
    const expensesMonth = expenses.rows[0].total;
    const delinquencyAmount = overdue.rows[0].total;
    const delinquencyCount = overdue.rows[0].count;
    const receivedMonth = received.rows[0].total;
    const expensesPaidMonth = expensesPaid.rows[0].total;

    return {
      month,
      forecast_month: forecastMonth,
      forecast_delta_pct: prevForecastMonth > 0 ? ((forecastMonth - prevForecastMonth) / prevForecastMonth) * 100 : null,
      expenses_month: expensesMonth,
      // Saldo/resumo REAL (realtime): baseado no que entrou (pago) e saiu (pago).
      received_month: receivedMonth,
      expenses_paid_month: expensesPaidMonth,
      balance_month: receivedMonth - expensesPaidMonth,
      delinquency_amount: delinquencyAmount,
      delinquency_count: delinquencyCount,
      expenses_by_category: byCategory.rows.map((r: any) => ({ category: r.category, total: Number(r.total) })),
    };
  });
  res.json({ ok: true, data });
});

// GET /api/finance/monthly — receitas (previstas/faturadas) x despesas dos últimos 12 meses.
financeRouter.get('/monthly', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select d.month,
              coalesce(r.total, 0)::float8 as receitas,
              coalesce(e.total, 0)::float8 as despesas
         from generate_series(
                date_trunc('month', now()) - interval '11 months',
                date_trunc('month', now()),
                interval '1 month'
              ) as d(month)
         left join (
           select reference_month, sum(amount) as total
             from public.invoices
            where school_id=$1 and status not in ('cancelled','refunded')
            group by reference_month
         ) r on r.reference_month = to_char(d.month, 'YYYY-MM')
         left join (
           select to_char(due_date,'YYYY-MM') as month, sum(amount) as total
             from public.expenses
            where school_id=$1 and status <> 'cancelled'
            group by 1
         ) e on e.month = to_char(d.month, 'YYYY-MM')
        order by d.month`,
      [req.ctx!.schoolId],
    );
    return rows.map((r: any) => ({
      month: new Date(r.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''),
      receitas: Number(r.receitas),
      despesas: Number(r.despesas),
    }));
  });
  res.json({ ok: true, data });
});

// GET /api/finance/delinquency — faturas vencidas e não pagas (inadimplência).
financeRouter.get('/delinquency', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select i.id, i.student_name, i.amount::float8 as amount, i.due_date, i.reference_month,
              g.name as guardian_name, sp.name as plan_name,
              (current_date - i.due_date)::int as days_late
         from public.invoices i
         left join public.students st on st.id = i.student_id
         left join public.guardians g on g.id = st.guardian_id
         left join public.school_plans sp on sp.id = st.plan_id
        where i.school_id = $1 and i.status = 'overdue'
        order by i.due_date asc`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});
