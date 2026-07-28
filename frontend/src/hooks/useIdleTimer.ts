import { useEffect, useRef, useState, useCallback } from 'react';

interface Options {
  /** Tempo total de inatividade até expirar (ms). */
  timeoutMs: number;
  /** Janela final em que o aviso/contagem aparece (ms). */
  warningMs: number;
  /** Chamado quando o tempo esgota. */
  onExpire: () => void;
}

interface IdleState {
  /** true quando estamos na janela final (mostrar contagem). */
  warning: boolean;
  /** Segundos restantes até expirar (0 quando fora do aviso). */
  secondsLeft: number;
  /** Reinicia o contador manualmente (ex.: botão "Continuar conectado"). */
  reset: () => void;
}

// Eventos de window que contam como interação do usuário.
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll',
];

/**
 * Detecta inatividade e dispara `onExpire` após `timeoutMs`. Durante os últimos
 * `warningMs`, expõe `warning=true` e `secondsLeft` para exibir uma contagem.
 * Qualquer interação do usuário reinicia o contador (com throttle) — a não ser
 * quando o aviso já está visível, para o usuário poder decidir conscientemente.
 */
export function useIdleTimer({ timeoutMs, warningMs, onExpire }: Options): IdleState {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const deadlineRef = useRef<number>(Date.now() + timeoutMs);
  const warningRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const reset = useCallback(() => {
    deadlineRef.current = Date.now() + timeoutMs;
    warningRef.current = false;
    setWarning(false);
    setSecondsLeft(0);
  }, [timeoutMs]);

  useEffect(() => {
    // Throttle: só reinicia o prazo no máximo 1x/segundo e nunca durante o aviso
    // (assim a contagem final não some por um mousemove acidental).
    let lastActivity = 0;
    const onActivity = () => {
      if (warningRef.current) return;
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastActivity < 1000) return;
      lastActivity = now;
      deadlineRef.current = now + timeoutMs;
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onActivity);

    // Tick de 1s: avalia janela de aviso e expiração.
    const tick = window.setInterval(() => {
      const remaining = deadlineRef.current - Date.now();
      if (remaining <= 0) {
        window.clearInterval(tick);
        onExpireRef.current();
        return;
      }
      if (remaining <= warningMs) {
        if (!warningRef.current) { warningRef.current = true; setWarning(true); }
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else if (warningRef.current) {
        warningRef.current = false;
        setWarning(false);
      }
    }, 1000);

    return () => {
      window.clearInterval(tick);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onActivity);
    };
  }, [timeoutMs, warningMs]);

  return { warning, secondsLeft, reset };
}
