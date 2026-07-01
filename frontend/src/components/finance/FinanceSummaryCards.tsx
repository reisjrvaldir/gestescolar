import { TrendingUp, TrendingDown, Wallet, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { brl } from '@/lib/fees';
import type { SummaryCard, SummaryIcon, Tone } from '@/data/finance/financeSummary';

const ICONS: Record<SummaryIcon, LucideIcon> = {
  revenue: TrendingUp,
  expense: TrendingDown,
  balance: Wallet,
  alert: AlertTriangle,
};

const TONE_BADGE: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  purple: 'bg-purple-soft text-purple',
};

interface Props {
  cards: SummaryCard[];
}

/** 4 cards principais de resumo da Visão geral. */
export function FinanceSummaryCards({ cards }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => {
        const Icon = ICONS[c.icon];
        const DeltaIcon = c.deltaTone === 'success' ? ArrowUpRight : ArrowDownRight;
        return (
          <div key={c.key} className="card p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-ink-muted">{c.label}</p>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE_BADGE[c.tone]}`}>
                <Icon size={18} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-ink">{brl(c.value)}</p>
            <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
              c.deltaTone === 'success' ? 'text-success' : 'text-danger'
            }`}>
              <DeltaIcon size={13} /> {c.deltaLabel}
            </p>
          </div>
        );
      })}
    </div>
  );
}
