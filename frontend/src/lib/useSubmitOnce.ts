import { useCallback, useRef, useState } from 'react';

/**
 * Envolve um handler assíncrono de modo que cliques repetidos enquanto a
 * ação está em execução sejam ignorados (evita cadastro duplicado por
 * duplo clique). Retorna também o estado `submitting` para desabilitar o
 * botão visualmente.
 */
export function useSubmitOnce<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setSubmitting(true);
      try {
        return await fn(...args);
      } finally {
        inFlight.current = false;
        setSubmitting(false);
      }
    },
    [fn],
  );

  return { run, submitting } as const;
}
