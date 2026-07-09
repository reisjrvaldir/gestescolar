import { PieChart } from 'lucide-react';
import { brl } from '@/lib/fees';
import type { ExpenseCategorySlice } from '@/services/finance';

const COLORS = ['#2563EB', '#00B894', '#6C5CE7', '#E84393', '#F59E0B', '#0EA5E9', '#EF4444', '#64748B'];

/** Donut (SVG puro) com a distribuição das despesas do mês por categoria. */
export function ExpensesByCategoryChart({ data }: { data: ExpenseCategorySlice[] }) {
  const total = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
        <PieChart size={16} className="text-primary" /> Para onde vão os gastos
      </div>

      {data.length === 0 || total === 0 ? (
        <p className="text-sm text-ink-muted">Nenhuma despesa registrada no mês.</p>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Donut data={data} total={total} />
          <div className="flex-1 space-y-2 self-stretch">
            {data.map((d, i) => (
              <div key={d.category} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink-muted">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                  {d.category}
                </span>
                <span className="font-semibold text-ink">
                  {brl(d.total)} <span className="text-xs font-normal text-ink-subtle">({((d.total / total) * 100).toFixed(0)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Donut({ data, total }: { data: ExpenseCategorySlice[]; total: number }) {
  const R = 60;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
      {data.map((d, i) => {
        const frac = d.total / total;
        const dash = frac * C;
        const offset = acc;
        acc += dash;
        return (
          <circle
            key={d.category}
            cx="80" cy="80" r={R}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth="22"
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-offset}
          />
        );
      })}
    </svg>
  );
}
