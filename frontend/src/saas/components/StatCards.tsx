import {
  School2, CheckCircle2, TrendingUp, AlertTriangle, Users, ArrowUpRight, ArrowDownRight,
  type LucideIcon,
} from 'lucide-react';
import type { StatCard } from '@/data/saas/dashboardData';

const ICONS: Record<StatCard['icon'], LucideIcon> = {
  schools: School2, active: CheckCircle2, revenue: TrendingUp, overdue: AlertTriangle, users: Users,
};
const TONE: Record<StatCard['tone'], string> = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  purple: 'bg-purple-soft text-purple',
};

export function StatCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((c) => {
        const Icon = ICONS[c.icon];
        const HintIcon = c.hintTone === 'success' ? ArrowUpRight : c.hintTone === 'danger' ? ArrowDownRight : null;
        return (
          <div key={c.key} className="card p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-ink-muted">{c.label}</p>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE[c.tone]}`}>
                <Icon size={18} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-ink">{c.value}</p>
            <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
              c.hintTone === 'success' ? 'text-success' : c.hintTone === 'danger' ? 'text-danger' : 'text-ink-subtle'
            }`}>
              {HintIcon && <HintIcon size={13} />} {c.hint}
            </p>
          </div>
        );
      })}
    </div>
  );
}
