import {
  Plus, Send, CircleDollarSign, QrCode, Upload, Download, AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { QuickAction, QuickActionIcon } from '@/data/finance/quickActionsData';

const ICONS: Record<QuickActionIcon, LucideIcon> = {
  expense: Plus,
  charge: CircleDollarSign,
  batch: Send,
  payment: CircleDollarSign,
  pix: QrCode,
  import: Upload,
  export: Download,
  delinquency: AlertTriangle,
};

interface Props {
  actions: QuickAction[];
  onAction?: (key: string) => void;
}

/** Grade de ações rápidas do financeiro. */
export function QuickActionsGrid({ actions, onAction }: Props) {
  return (
    <section aria-labelledby="acoes-rapidas">
      <h3 id="acoes-rapidas" className="mb-3 text-sm font-bold text-ink">Ações rápidas</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {actions.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <button
              key={a.key}
              onClick={() => onAction?.(a.key)}
              className="card group flex items-start gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{a.title}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{a.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
