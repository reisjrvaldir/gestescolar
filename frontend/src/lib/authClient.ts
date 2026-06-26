import { createAuthClient } from 'better-auth/react';
import { jwtClient } from 'better-auth/client/plugins';
import { setTokenProvider } from './api';

// Cliente Better Auth apontando para o Neon Auth.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_NEON_AUTH_URL as string,
  plugins: [jwtClient()],
});

// O backend valida o JWT (via JWKS). Aqui obtemos o token do Better Auth
// e registramos no client de API para anexar em cada request.
setTokenProvider(async () => {
  try {
    const { data } = await authClient.token();
    return data?.token ?? null;
  } catch {
    return null;
  }
});

export const { useSession, signIn, signUp, signOut, changePassword } = authClient;
