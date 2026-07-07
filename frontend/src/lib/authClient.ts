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

// Reset de senha (Better Auth). Os métodos vêm do plugin email/senha do servidor
// (Neon Auth) e não são tipados no client — acessados via `any` com fallback de
// nome entre versões (`requestPasswordReset` novo / `forgetPassword` antigo).
export async function requestPasswordReset(email: string, redirectTo: string): Promise<any> {
  const c = authClient as any;
  const fn = c.requestPasswordReset ?? c.forgetPassword;
  if (!fn) throw new Error('Reset de senha indisponível');
  return fn({ email, redirectTo });
}

export async function resetPassword(newPassword: string, token: string): Promise<any> {
  return (authClient as any).resetPassword({ newPassword, token });
}
