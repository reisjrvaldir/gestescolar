import { CheckCircle2, Clock, AlertTriangle, MailX } from 'lucide-react';
import type { InviteState } from '@/types/models';

const MAP: Record<InviteState, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  activated: { label: 'Acesso ativado',  cls: 'bg-success-soft text-success', Icon: CheckCircle2 },
  pending:   { label: 'Convite pendente', cls: 'bg-warning-soft text-warning', Icon: Clock },
  expired:   { label: 'Convite expirado', cls: 'bg-danger-soft text-danger',   Icon: AlertTriangle },
  none:      { label: 'Sem convite',      cls: 'bg-canvas text-ink-subtle',    Icon: MailX },
};

/** Badge de estado do acesso: pendente, expirado, ativado ou sem convite. */
export function InviteBadge({ state, className = '' }: { state?: InviteState; className?: string }) {
  const cfg = MAP[state ?? 'none'];
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.cls} ${className}`}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
}
