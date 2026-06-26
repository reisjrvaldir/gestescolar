const AUTH_URL = process.env.NEON_AUTH_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://gestescolar.com.br';

export interface SignUpResult {
  authUserId: string;
  email: string;
}

export async function signUpGuardian(params: {
  email: string;
  password: string;
  name: string;
}): Promise<SignUpResult> {
  if (!AUTH_URL) {
    throw new Error('NEON_AUTH_URL não configurado — não foi possível criar login do responsável');
  }

  const base = AUTH_URL.replace(/\/+$/, '');
  const url = `${base}/sign-up/email`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
