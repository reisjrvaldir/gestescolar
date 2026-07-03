import type { Slice } from '@/data/saas/dashboardData';

interface Props { title: string; subtitle?: string; slices: Slice[] }

/** Donut chart em SVG (sem dependência externa). Renderiza os arcos via
 *  stroke-dasharray sobre um círculo, técnica clássica e barata. */
export function DonutChart({ title, subtitle, slices }: Props) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 42;               // raio
  const C = 2 * Math.PI * R;  // circunferência

  let acc = 0;
  const rings = slices.map((s) => {
    const dash = (s.value / total) * C;
    const gap = C - dash;
    const offset = -acc; // negativa para começar no topo
    acc += dash;
    return { color: s.color, dash, gap, offset };
  });

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>}
      <div className="mt-4 flex items-center gap-6">
        <div className="relative">
          <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#E2E8F0" strokeWidth="14" />
            {rings.map((r, i) => (
              <circle
                key={i} cx="50" cy="50" r={R} fill="none"
                stroke={r.color} strokeWidth="14"
                strokeDasharray={`${r.dash} ${r.gap}`}
                strokeDashoffset={r.offset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-extrabold text-ink">{total}</span>
            <span className="text-[10px] uppercase text-ink-subtle">total</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-2 text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-semibold text-ink">
                {s.value} <span className="text-ink-subtle">({((s.value / total) * 100).toFixed(1)}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
