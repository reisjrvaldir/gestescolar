import { brl } from '@/lib/fees';
import type { MonthBalance } from '@/data/finance/financeChartData';

interface Props {
  data: MonthBalance[];
}

/**
 * Gráfico de barras agrupadas (receitas x despesas) dos últimos meses.
 * Feito em CSS/flex para não adicionar dependência de biblioteca de gráficos,
 * mantendo consistência com o restante do app. Trocável por Recharts se
 * o projeto passar a usar uma lib de gráficos.
 */
export function RevenueExpenseChart({ data }: Props) {
  const max = Math.max(1, ...data.flatMap((d) => [d.receitas, d.despesas]));

  return (
    <div className="card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">Balanço mensal entre receitas e despesas</h3>
        <div className="flex items-center gap-4 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" /> Receitas</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-danger" /> Despesas</span>
        </div>
      </div>
      <p className="mb-4 text-xs text-ink-subtle">Últimos 12 meses</p>

      <div className="flex h-56 items-end gap-2 overflow-x-auto pb-1">
        {data.map((d) => (
          <div key={d.month} className="group flex min-w-[36px] flex-1 flex-col items-center gap-1.5">
            <div className="flex h-48 w-full items-end justify-center gap-1">
              <div
                className="w-1/2 max-w-[16px] rounded-t bg-success/80 transition-all group-hover:bg-success"
                style={{ height: `${Math.max(2, (d.receitas / max) * 100)}%` }}
                title={`Receitas: ${brl(d.receitas)}`}
                aria-label={`Receitas em ${d.month}: ${brl(d.receitas)}`}
              />
              <div
                className="w-1/2 max-w-[16px] rounded-t bg-danger/80 transition-all group-hover:bg-danger"
                style={{ height: `${Math.max(2, (d.despesas / max) * 100)}%` }}
                title={`Despesas: ${brl(d.despesas)}`}
                aria-label={`Despesas em ${d.month}: ${brl(d.despesas)}`}
              />
            </div>
            <span className="whitespace-nowrap text-[10px] text-ink-muted">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
