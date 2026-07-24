import { useCallback, useRef, useState } from 'react';

/**
 * Envolve um handler assíncrono para que cliques repetidos enquanto a ação
 * está em execução sejam IGNORADOS (evita cadastro duplicado por duplo clique).
 *
 * Implementação defensiva:
 *  - `inFlight` (ref) barra imediatamente qualquer chamada concorrente;
 *  - `fnRef` mantém sempre o handler mais recente sem invalidar `run`, para
 *    que `run` seja uma referência estável entre renders (o disabled do
 *    botão pode demorar 1 frame — o ref é a barreira real).
 *
 * Retorna também `submitting` para reflexo visual (botão desabilitado, spinner).
 */
export function useSubmitOnce<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const inFlight = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const [submitting, setSubmitting] = useState(false);

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setSubmitting(true);
    try {
      return await fnRef.current(...args);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, []);

  return { run, submitting } as const;
}
