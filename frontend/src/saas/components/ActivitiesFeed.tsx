import { UserPlus, ArrowUpDown, CheckCircle2, XCircle, UserCog, type LucideIcon } from 'lucide-react';
import type { SaasActivity } from '@/services/saas';

const CFG: Record<SaasActivity['type'], { icon: LucideIcon; tone: string }> = {
  school_created:    { icon: UserPlus,    tone: 'bg-primary-soft text-primary' },
  plan_changed:      { icon: ArrowUpDown, tone: 'bg-purple-soft text-purple' },
  payment_received:  { icon: CheckCircle2, tone: 'bg-success-soft text-success' },
  school_suspended:  { icon: XCircle,     tone: 'bg-danger-soft text-danger' },
  user_created:      { icon: UserCog,     tone: 'bg-warning-soft text-warning' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `${d} dias atrás`;
}

export function ActivitiesFeed({ items }: { items: SaasActivity[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5">
        <h3 className="text-sm font-bold text-ink">Atividades recentes</h3>
      </div>
      <div className="divide-y divide-border">
        {items.map((a, i) => {
          const cfg = CFG[a.type] ?? CFG.user_created;
          const Icon = cfg.icon;
          return (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.tone}`}>
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{a.title}</p>
                {a.subtitle && <p className="truncate text-xs text-ink-muted">{a.subtitle}</p>}
              </div>
              <span className="shrink-0 text-xs text-ink-subtle">{timeAgo(a.at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
