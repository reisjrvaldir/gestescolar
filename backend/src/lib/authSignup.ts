const AUTH_URL = process.env.NEON_AUTH_URL;

export interface SignUpResult {
  authUserId: string;
  email: string;
}

const SIGN_UP_PATHS = [
  '/api/auth/sign-up/email',
  '/sign-up/email',
  '/api/sign-up/email',
];

export async function signUpGuardian(params: {
  email: string;
  password: string;
  name: string;
}): Promise<SignUpResult> {
  if (!AUTH_URL) {
    throw new Error('NEON_AUTH_URL não configurado — não foi possível criar login do responsável');
  }

  const base = AUTH_URL.replace(/\/+$/, '');
  const body = JSON.stringify({
    email: params.email,
    password: params.password,
    name: params.name,
  });

  let lastStatus = 0;
  let lastBody = '';

  for (const path of SIGN_UP_PATHS) {
    const url = `${base}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.status === 404) {
      lastStatus = 404;
      lastBody = await res.text().catch(() => '');
      continue;
    }

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

  throw Object.assign(
    new Error(
      `Nenhum endpoint de sign-up encontrado no Neon Auth (tentou ${SIGN_UP_PATHS.join(', ')} em ${base}). ` +
      `Último status: ${lastStatus}. Verifique NEON_AUTH_URL. Resposta: ${lastBody.slice(0, 200)}`,
    ),
    { http: 500 },
  );
}
