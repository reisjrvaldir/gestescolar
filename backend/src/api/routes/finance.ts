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

/** Resolve a janela [from, to] (datas ISO YYYY-MM-DD, inclusivas) a partir de
 *  parâmetros da query. Suporta:
 *   - `from` + `to`  → janela livre (usada para trimestre/semestre/ano).
 *   - `month=YYYY-MM` → mês inteiro (compat com chamadas antigas / default).
 *   - nada → mês atual. */
function resolveRange(q: { from?: string; to?: string; month?: string }): { from: string; to: string; monthKey: string } {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const monthRe = /^\d{4}-\d{2}$/;
  if (q.from && q.to && iso.test(q.from) && iso.test(q.to)) {
    return { from: q.from, to: q.to, monthKey: q.from.slice(0, 7) };
  }
  const month = q.month && monthRe.test(q.month) ? q.month : currentMonth();
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { from: first, to: last, monthKey: month };
}

// GET /api/finance/summary — indicadores reais do período consultado.
// Aceita:
//   - ?from=YYYY-MM-DD&to=YYYY-MM-DD  (janela livre — trimestre/semestre/ano)
//   - ?month=YYYY-MM                  (compat com chamadas antigas)
//   - nada                            (mês atual)
// Despesas SEMPRE excluem itens da lixeira (deleted_at not null) e cancelados.
financeRouter.get('/summary', async (req, res) => {
  const range = resolveRange({
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    month: req.query.month as string | undefined,
  });

  // Para o card "Previsão de receita" (mensalidades por reference_month) usamos
  // o range em termos de meses YYYY-MM: do mês do `from` ao mês do `to`.
  const monthFrom = range.from.slice(0, 7);
  const monthTo = range.to.slice(0, 7);
  // Janela do "mês anterior" ao início do range (mesmo tamanho de 1 mês; usado
  // apenas para a variação % do card de previsão).
  const [yFrom, mFrom] = monthFrom.split('-').map(Number);
  const prev = new Date(yFrom, (mFrom - 1) - 1, 1);
  const prevMonthKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  const data = await withTenant(req.ctx!, async (c) => {
    const [forecast, prevForecast, expenses, overdue, received, expensesPaid, byCategory] = await Promise.all([
      // Previsão de RECEITA — soma faturas cujo reference_month cai na janela.
      c.query(
        `select coalesce(sum(amount),0)::float8 as total
           from public.invoices
          where school_id=$1 and reference_month between $2 and $3
            and status not in ('cancelled','refunded')`,
        [req.ctx!.schoolId, monthFrom, monthTo],
      ),
      // Previsão do mês anterior (só o mês imediatamente anterior ao início) para variação %.
      c.query(
        `select coalesce(sum(amount),0)::float8 as total
           from public.invoices
          where school_id=$1 and reference_month=$2
            and status not in ('cancelled','refunded')`,
        [req.ctx!.schoolId, prevMonthKey],
      ),
      // Despesas do período (previstas + pagas). IGNORA lixeira.
      c.query(
        `select coalesce(sum(amount),0)::float8 as total
           from public.expenses
          where school_id=$1
            and due_date between $2::date and $3::date
            and status <> 'cancelled'
            and deleted_at is null`,
        [req.ctx!.schoolId, range.from, range.to],
      ),
      // Inadimplência é global (não faz sentido janelar — quem está devendo agora).
      c.query(
        `select coalesce(sum(amount),0)::float8 as total, count(*)::int as count
           from public.invoices
          where school_id=$1 and status='overdue'`,
        [req.ctx!.schoolId],
      ),
      // Recebido de fato no período (faturas pagas por paid_at).
      c.query(
        `select coalesce(sum(amount),0)::float8 as total
           from public.invoices
          where school_id=$1 and status='paid'
            and paid_at::date between $2::date and $3::date`,
        [req.ctx!.schoolId, range.from, range.to],
      ),
      // Despesas efetivamente pagas no período (por due_date, mesma base).
      c.query(
        `select coalesce(sum(amount),0)::float8 as total
           from public.expenses
          where school_id=$1 and status='paid'
            and due_date between $2::date and $3::date
            and deleted_at is null`,
        [req.ctx!.schoolId, range.from, range.to],
      ),
      // Despesas do período por categoria (para o gráfico de gastos).
      c.query(
        `select coalesce(nullif(trim(category),''),'Outros') as category,
                coalesce(sum(amount),0)::float8 as total
           from public.expenses
          where school_id=$1
            and due_date between $2::date and $3::date
            and status <> 'cancelled'
            and deleted_at is null
          group by 1 order by total desc`,
        [req.ctx!.schoolId, range.from, range.to],
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
      month: range.monthKey, // compat
      range: { from: range.from, to: range.to },
      forecast_month: forecastMonth,
      forecast_delta_pct: prevForecastMonth > 0 ? ((forecastMonth - prevForecastMonth) / prevForecastMonth) * 100 : null,
      expenses_month: expensesMonth,
      // Saldo/resumo REAL: baseado no que entrou (pago) e saiu (pago) no período.
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

// GET /api/finance/monthly — receitas x despesas dos últimos 12 meses.
// Também ignora a lixeira de despesas.
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
            where school_id=$1 and status <> 'cancelled' and deleted_at is null
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
