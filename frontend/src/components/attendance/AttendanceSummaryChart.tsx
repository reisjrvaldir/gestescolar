import { PieChart, Loader2 } from 'lucide-react';
import type { AttendanceSummary } from '@/services/attendance';

const SLICES: { key: keyof AttendanceSummary; label: string; color: string }[] = [
  { key: 'present',   label: 'Presentes',        color: '#00B894' },
  { key: 'absent',    label: 'Faltas',            color: '#EF4444' },
  { key: 'justified', label: 'Falta Justificada', color: '#F59E0B' },
  { key: 'excused',   label: 'Abono (Atestado)',  color: '#7C3AED' },
];

interface Props {
  summary: AttendanceSummary | null;
  loading: boolean;
  scope: 'month' | '30d';
  onScopeChange: (scope: 'month' | '30d') => void;
}

export function AttendanceSummaryChart({ summary, loading, scope, onScopeChange }: Props) {
  const data = summary ? SLICES.map((s) => ({ ...s, value: summary[s.key] })).filter((s) => s.value > 0) : [];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <PieChart size={16} className="text-primary" /> Resumo de frequência
        </div>
        <div className="flex rounded-lg border border-border p-0.5 text-xs">
          <button
            className={`rounded-md px-2 py-1 font-semibold ${scope === 'month' ? 'bg-primary text-white' : 'text-ink-muted'}`}
            onClick={() => onScopeChange('month')}
          >Mês</button>
          <button
            className={`rounded-md px-2 py-1 font-semibold ${scope === '30d' ? 'bg-primary text-white' : 'text-ink-muted'}`}
            onClick={() => onScopeChange('30d')}
          >30 dias</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8 text-ink-muted"><Loader2 size={18} className="animate-spin" /></div>
      ) : total === 0 ? (
        <p className="py-4 text-center text-xs text-ink-muted">Nenhuma chamada registrada no período.</p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Donut data={data} total={total} />
          <div className="w-full space-y-1.5">
            {data.map((d) => (
              <div key={d.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                  {d.label}
                </span>
                <span className="font-semibold text-ink">
                  {d.value} <span className="font-normal text-ink-subtle">({((d.value / total) * 100).toFixed(0)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Donut({ data, total }: { data: { key: string; color: string; value: number }[]; total: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg viewBox="0 0 130 130" className="h-32 w-32 -rotate-90">
      {data.map((d) => {
        const frac = d.value / total;
        const dash = frac * C;
        const offset = acc;
        acc += dash;
        return (
          <circle
            key={d.key}
            cx="65" cy="65" r={R}
            fill="none"
            stroke={d.color}
            strokeWidth="18"
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-offset}
          />
        );
      })}
    </svg>
  );
}
