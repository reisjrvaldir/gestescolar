// Client HTTP do frontend → Backend API (que fala com o Neon).
// O frontend NUNCA acessa o banco direto. O token do Neon Auth é
// anexado em cada request; o backend valida e injeta o school_id.

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

let getToken: () => Promise<string | null> = async () => null;

/** Registrado uma vez no bootstrap (ex.: a partir do Neon Auth/Stack). */
export function setTokenProvider(fn: () => Promise<string | null>) {
  getToken = fn;
}

// Deduplica chamadas concorrentes ao getToken(): múltiplos requests em
// Promise.all() compartilham a mesma promise em-voo em vez de disparar
// várias buscas de token simultaneamente.
let tokenInflight: Promise<string | null> | null = null;

async function request<T>(path: string, init: RequestInit = {}, retryUnauthorized = true): Promise<T> {
  if (!tokenInflight) {
    tokenInflight = getToken().finally(() => { tokenInflight = null; });
  }
  const token = await tokenInflight;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  // A sessão e o JWT podem propagar em momentos ligeiramente diferentes logo
  // após o login. Em 401, obtenha um token novo e repita uma única vez.
  if (res.status === 401 && retryUnauthorized) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return request<T>(path, init, false);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.code ?? 'error', body.message ?? res.statusText, body.errors);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public errors?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Para respostas binárias (PDF etc.) — mesma autenticação de `request`, mas
 *  sem forçar `res.json()`. Usado pelos endpoints de emissão de documentos. */
async function requestBlob(path: string): Promise<Blob> {
  if (!tokenInflight) {
    tokenInflight = getToken().finally(() => { tokenInflight = null; });
  }
  const token = await tokenInflight;
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.code ?? 'error', body.message ?? res.statusText, body.errors);
  }
  return res.blob();
}

export const api = {
  get: <T>(p: string, signal?: AbortSignal) => request<T>(p, signal ? { signal } : {}),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
  getBlob: requestBlob,
};
