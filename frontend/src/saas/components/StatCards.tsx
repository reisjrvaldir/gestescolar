import {
  School2, CheckCircle2, TrendingUp, AlertTriangle, Users, ArrowUpRight, ArrowDownRight,
  type LucideIcon,
} from 'lucide-react';
import { brl } from '@/lib/fees';
import type { SaasMetrics } from '@/services/saas';

interface Card {
  key: string; label: string; value: string; hint: string;
  hintTone: 'success' | 'danger' | 'muted'; tone: string; icon: LucideIcon;
}

const TONE: Record<string, string> = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  purple: 'bg-purple-soft text-purple',
};

function buildCards(m: SaasMetrics): Card[] {
  const delta = m.revenue_delta_pct;
  return [
    { key: 'schools', label: 'Escolas cadastradas', value: String(m.total_schools),
      hint: `+${m.new_this_month} nova(s) este mês`, hintTone: m.new_this_month > 0 ? 'success' : 'muted', tone: 'primary', icon: School2 },
    { key: 'active', label: 'Escolas ativas', value: String(m.active_schools),
      hint: `${m.active_pct.toFixed(1)}% do total`, hintTone: 'muted', tone: 'success', icon: CheckCircle2 },
    { key: 'revenue', label: 'Receita do mês (SaaS)', value: brl(m.revenue_month),
      hint: delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs mês anterior` : 'sem histórico anterior',
      hintTone: delta == null ? 'muted' : delta >= 0 ? 'success' : 'danger', tone: 'purple', icon: TrendingUp },
    { key: 'overdue', label: 'Escolas em atraso', value: String(m.overdue_schools),
      hint: `${m.overdue_pct.toFixed(1)}% do total`, hintTone: m.overdue_schools > 0 ? 'danger' : 'muted', tone: 'danger', icon: AlertTriangle },
    { key: 'users', label: 'Usuários ativos', value: m.active_users.toLocaleString('pt-BR'),
      hint: 'total na plataforma', hintTone: 'muted', tone: 'primary', icon: Users },
  ];
}

export function StatCards({ metrics }: { metrics: SaasMetrics }) {
  const cards = buildCards(metrics);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
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
