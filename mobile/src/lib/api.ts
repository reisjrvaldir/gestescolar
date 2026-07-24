import { storage } from './storage';

export const API_URL = 'https://backend-pi-snowy-15.vercel.app';
export const AUTH_URL = 'https://ep-red-dew-ac308bfw.neonauth.sa-east-1.aws.neon.tech/neondb/auth';

/**
 * Troca a sessão Better Auth (cookie persistido pela camada nativa do RN) por um
 * JWT curto. O backend valida esse JWT via JWKS. Guardamos o JWT para reuso e
 * renovamos quando expira (401).
 */
export async function refreshJwt(): Promise<string | null> {
  try {
    const res = await fetch(`${AUTH_URL}/token`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const jwt: string | undefined = data?.token;
    if (jwt) { await storage.setToken(jwt); return jwt; }
    return null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = await storage.getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  // JWT expirado → renova uma vez e repete a chamada.
  if (res.status === 401 && retry) {
    const fresh = await refreshJwt();
    if (fresh) return request<T>(path, options, false);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
