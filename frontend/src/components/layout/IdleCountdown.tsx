import { Clock, LogOut } from 'lucide-react';

interface Props {
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}

function fmt(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Aviso de expiração de sessão por inatividade, fixo no canto inferior direito.
 * Mostra a contagem regressiva e permite continuar conectado ou sair agora.
 */
export function IdleCountdown({ secondsLeft, onStay, onLogout }: Props) {
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Sessão prestes a expirar por inatividade"
      className="fixed bottom-4 right-4 z-[100] w-[19rem] rounded-2xl border border-warning/40 bg-surface p-4 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
          <Clock size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Sessão prestes a expirar</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Por inatividade, você será desconectado em{' '}
            <span className="font-mono font-bold text-warning" aria-hidden="true">{fmt(secondsLeft)}</span>
            <span className="sr-only">{secondsLeft} segundos</span>.
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-canvas"
          onClick={onLogout}
        >
          <LogOut size={13} /> Sair agora
        </button>
        <button className="btn-primary px-3 py-1.5 text-xs" onClick={onStay}>
          Continuar conectado
        </button>
      </div>
    </div>
  );
}
