import { TrendingUp } from 'lucide-react';
import type { MonthPoint } from '@/services/saas';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function RevenueChart({ data }: { data: MonthPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-ink">Receita do SaaS</h3>
          <p className="text-xs text-ink-subtle">Evolução mensal — últimos 12 meses</p>
        </div>
        <TrendingUp size={18} className="text-success" />
      </div>
      <div className="flex h-52 items-end gap-2 overflow-x-auto pb-1">
        {data.map((d, i) => (
          <div key={i} className="group flex min-w-[38px] flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-medium text-ink-subtle opacity-0 group-hover:opacity-100">
              {brl(d.revenue)}
            </span>
            <div
              className="w-full max-w-[24px] rounded-t-lg bg-gradient-to-t from-primary to-purple transition-all group-hover:brightness-110"
              style={{ height: `${Math.max(4, (d.revenue / max) * 100)}%` }}
              title={`${d.month}: ${brl(d.revenue)}`}
            />
            <span className="text-[10px] text-ink-muted">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
