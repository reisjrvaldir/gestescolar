const FRONTEND_URL = process.env.FRONTEND_URL || 'https://gestescolar.com.br';

export interface SignUpResult {
  authUserId: string;
  email: string;
}

/**
 * Resolve a URL base do Neon Auth (Better Auth) de forma resiliente.
 *
 * Motivo: em produção a env `NEON_AUTH_URL` já apareceu configurada apenas com a
 * ORIGEM (sem o caminho `/neondb/auth`), o que fazia o cadastro chamar
 * `https://host/sign-up/email` → HTTP 404, quebrando TODOS os formulários que
 * criam login (responsável do aluno, staff, etc.). O login não quebrava porque a
 * validação do JWT usa apenas a origem + `NEON_AUTH_JWKS_URL`.
 *
 * Estratégia (em ordem de confiança):
 *   1. Derivar da `NEON_AUTH_JWKS_URL` — que é comprovadamente correta em produção
 *      (se o login funciona, o JWKS está certo). Basta remover o sufixo
 *      `/.well-known/jwks.json` para obter a base do Better Auth.
 *   2. Usar `NEON_AUTH_URL`, garantindo que contenha o mount do Auth: se vier só a
 *      origem, normalizamos para `${origin}/neondb/auth`.
 */
function resolveAuthBase(): string {
  const jwks = process.env.NEON_AUTH_JWKS_URL;
  if (jwks) {
    const base = jwks.replace(/\/+$/, '').replace(/\/\.well-known\/jwks\.json$/i, '');
    if (base && base !== jwks.replace(/\/+$/, '')) return base;
  }

  const raw = process.env.NEON_AUTH_URL;
  if (raw) {
    const trimmed = raw.replace(/\/+$/, '');
    try {
      const u = new URL(trimmed);
      // Se o path não inclui o mount do Auth (ex.: veio só a origem), normaliza.
      if (!/\/auth(\/|$)/i.test(u.pathname)) {
        return `${u.origin}/neondb/auth`;
      }
    } catch {
      /* URL inválida — devolve como está e deixa o fetch falhar com mensagem clara */
    }
    return trimmed;
  }

  return '';
}

export async function signUpGuardian(params: {
  email: string;
  password: string;
  name: string;
}): Promise<SignUpResult> {
  const base = resolveAuthBase();
  if (!base) {
    throw new Error(
      'Neon Auth não configurado (defina NEON_AUTH_JWKS_URL ou NEON_AUTH_URL) — não foi possível criar login do responsável',
    );
  }

  const url = `${base}/sign-up/email`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Origin é obrigatório no Better Auth quando o callbackURL não é absoluto.
      'Origin': FRONTEND_URL,
    },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      name: params.name,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw Object.assign(
      new Error(`Falha ao criar login do responsável (HTTP ${res.status}): ${errBody.slice(0, 200)}`),
      { http: res.status >= 400 && res.status < 500 ? 400 : 500 },
    );
  }

  const data: any = await res.json().catch(() => ({}));
  const authUserId = data?.user?.id ?? data?.id;
  if (!authUserId) {
    throw new Error('Resposta do Neon Auth não retornou user.id');
  }
  return { authUserId: String(authUserId), email: params.email };
}
