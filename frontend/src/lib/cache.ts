import { useState, useEffect, useRef, useCallback } from 'react';

// Cache em memória com TTL — vive enquanto a aba estiver aberta.
// Use para dados de leitura que mudam raramente na sessão (alunos, turmas,
// configurações). Após mutações chame invalidate() para forçar refetch.

type Entry<T> = { data: T; at: number };
const store = new Map<string, Entry<unknown>>();

export const queryCache = {
  get<T>(key: string, ttlMs: number): T | null {
    const e = store.get(key) as Entry<T> | undefined;
    return e && Date.now() - e.at < ttlMs ? e.data : null;
  },
  set<T>(key: string, data: T): void {
    store.set(key, { data, at: Date.now() });
  },
  invalidate(key: string): void {
    store.delete(key);
  },
  /** Remove todas as entradas cujo prefixo bate — útil para padrões tipo /students/* */
  invalidatePrefix(prefix: string): void {
    for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
  },
};

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Hook de fetching com cache TTL.
 * - Retorna dados do cache imediatamente se ainda válidos.
 * - Mostra loading=true só na primeira carga (cache miss).
 * - Separa estado loading / error / success — nunca mostra empty enquanto carrega.
 * - retry via reload().
 *
 * @param key    Chave de cache (ex.: '/students')
 * @param fetcher Função que retorna a Promise dos dados
 * @param ttlMs  Tempo de validade em ms (padrão: 60 s)
 */
export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
): QueryState<T> {
  // fetcherRef evita que fetcher inline cause re-render infinito
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>(() => {
    const cached = queryCache.get<T>(key, ttlMs);
    return { data: cached, loading: cached === null, error: null };
  });

  const run = useCallback(async (force = false) => {
    if (!force) {
      const cached = queryCache.get<T>(key, ttlMs);
      if (cached !== null) {
        setState({ data: cached, loading: false, error: null });
        return;
      }
    }
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetcherRef.current();
      queryCache.set(key, data);
      setState({ data, loading: false, error: null });
    } catch (e: any) {
      setState(prev => ({ ...prev, loading: false, error: e?.message ?? 'Erro ao carregar.' }));
    }
  }, [key, ttlMs]);

  useEffect(() => { run(); }, [run]);

  return { ...state, reload: () => run(true) };
}
