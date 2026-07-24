import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { Period, Range } from '@/lib/period';
import { rangeFor, shiftPeriod, todayRange } from '@/lib/period';

interface Props {
  value: Range;
  onChange: (r: Range) => void;
}

const OPTIONS: { key: Period; label: string }[] = [
  { key: 'month', label: 'Mês' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'half', label: 'Semestre' },
  { key: 'year', label: 'Ano' },
];

/** Seletor de período (mês/trimestre/semestre/ano) com setas de navegação e botão "Hoje". */
export function PeriodPicker({ value, onChange }: Props) {
  const isToday = value.anchor === todayRange(value.period).anchor;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-card">
      <div className="inline-flex rounded-lg border border-border bg-canvas p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`rounded-md px-3 py-1 text-xs font-semibold ${
              value.period === o.key ? 'bg-primary text-white' : 'text-ink-muted hover:bg-surface hover:text-ink'
            }`}
            onClick={() => onChange(rangeFor(o.key, value.anchor))}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="rounded-lg border border-border bg-surface p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
          onClick={() => onChange(shiftPeriod(value, -1))}
          title="Período anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex min-w-[200px] items-center justify-center gap-2 rounded-lg bg-canvas px-3 py-1.5 text-sm font-semibold text-ink">
          <Calendar size={14} className="text-ink-muted" />
          <span className="capitalize">{value.label}</span>
        </div>
        <button
          type="button"
          className="rounded-lg border border-border bg-surface p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
          onClick={() => onChange(shiftPeriod(value, 1))}
          title="Próximo período"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {!isToday && (
        <button
          type="button"
          className="btn-outline !h-8 !px-3 !py-0 text-xs"
          onClick={() => onChange(todayRange(value.period))}
        >
          Ir para hoje
        </button>
      )}

      <span className="ml-auto text-[11px] text-ink-subtle">
        {value.from.split('-').reverse().join('/')} — {value.to.split('-').reverse().join('/')}
      </span>
    </div>
  );
}
