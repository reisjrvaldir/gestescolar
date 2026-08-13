import { createAuthClient } from 'better-auth/react';
import { jwtClient } from 'better-auth/client/plugins';
import { setTokenProvider } from './api';

// Cliente Better Auth apontando para o Neon Auth.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_NEON_AUTH_URL as string,
  plugins: [jwtClient()],
});

/** Obtém o JWT emitido pelo plugin do Better Auth.
 *
 * O endpoint /token é a fonte principal. Logo após o sign-in, porém, a sessão
 * pode aparecer em getSession alguns milissegundos antes de /token responder.
 * Nessa janela usamos o cabeçalho oficial set-auth-jwt retornado por
 * get-session e repetimos brevemente, evitando chamar a API sem Authorization.
 */
export async function getAccessToken(maxAttempts = 4): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { data } = await authClient.token();
      if (data?.token) return data.token;
    } catch { /* tenta o cabeçalho de get-session */ }

    try {
      let headerToken: string | null = null;
      await (authClient as any).getSession({
        fetchOptions: {
          onSuccess: (ctx: any) => {
            headerToken = ctx?.response?.headers?.get?.('set-auth-jwt') ?? null;
          },
        },
      });
      if (headerToken) return headerToken;
    } catch { /* tenta novamente após o atraso */ }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  return null;
}

// O backend valida o JWT (via JWKS). Registramos a fonte resiliente acima no
// client de API para anexar o token em cada request protegido.
setTokenProvider(() => getAccessToken());

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
