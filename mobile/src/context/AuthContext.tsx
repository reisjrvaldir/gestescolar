import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '@/lib/storage';
import { API_URL, AUTH_URL, refreshJwt } from '@/lib/api';

export type Role = 'school_admin' | 'financial' | 'teacher' | 'coordinator' | 'guardian' | 'superadmin';

export interface Me {
  profile_id: string;
  name: string;
  email: string;
  role: Role;
  school_id: string;
  school_name: string;
  school_status: string;
  password_change_required?: boolean;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  me: null, loading: true,
  signIn: async () => {}, signOut: async () => {},
});

/** Extrai "nome=valor" do primeiro cookie de um header Set-Cookie. */
function firstCookiePair(setCookie: string): string | null {
  // Ex.: "__Secure-neon-auth.session_token=abc.def%3D; Max-Age=604800; Path=/; HttpOnly..."
  const m = setCookie.match(/^([^=]+)=([^;]+)/);
  return m ? `${m[1]}=${m[2]}` : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, m] = await Promise.all([storage.getToken(), storage.getMe()]);
      if (t && m) setMe(m as Me);
      setLoading(false);
    })();
  }, []);

  async function signIn(identifier: string, password: string) {
    // Matrícula (F + números) → resolve o e-mail antes do login.
    let email = identifier;
    if (/^F\d+$/i.test(identifier.trim())) {
      const r = await fetch(`${API_URL}/api/public/login-email?matricula=${encodeURIComponent(identifier.trim())}`);
      const d = await r.json();
      if (!r.ok || !d?.data?.email) throw new Error('Matrícula não encontrada');
      email = d.data.email;
    }

    // 1) Sign-in no Neon Auth (Better Auth).
    const res = await fetch(`${AUTH_URL}/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message ?? 'E-mail ou senha inválidos');

    // 2) Captura credenciais da sessão SEM depender de cookie automático:
    //    - token de sessão vem no corpo da resposta
    //    - cookie completo (com assinatura) vem no header Set-Cookie
    const sessionToken: string | undefined = data?.token;
    if (sessionToken) await storage.setSession(sessionToken);

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const pair = firstCookiePair(setCookie);
      if (pair) await storage.setCookie(pair);
    }

    if (!sessionToken && !setCookie) {
      throw new Error('Sessão não recebida do servidor de autenticação');
    }

    // 3) Troca a sessão por um JWT (plugin JWT do Better Auth).
    const jwt = await refreshJwt();
    if (!jwt) throw new Error('Não foi possível obter o token de acesso');

    // 4) Carrega o perfil do backend (que valida o JWT via JWKS).
    const meRes = await fetch(`${API_URL}/api/me`, { headers: { Authorization: `Bearer ${jwt}` } });
    const meData = await meRes.json().catch(() => ({}));
    if (!meRes.ok) throw new Error('Erro ao carregar perfil');
    if (!meData?.hasProfile || !meData?.profile) {
      throw new Error('Sua conta ainda não tem perfil vinculado a uma escola.');
    }

    const profile: Me = meData.profile;
    await storage.setMe(profile);
    setMe(profile);
  }

  async function signOut() {
    try {
      const session = await storage.getSession();
      const cookie = await storage.getCookie();
      await fetch(`${AUTH_URL}/sign-out`, {
        method: 'POST',
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(session ? { Authorization: `Bearer ${session}` } : {}),
        },
      });
    } catch {}
    await storage.clearAll();
    setMe(null);
  }

  return (
    <AuthContext.Provider value={{ me, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
export function useMe() { return useContext(AuthContext).me; }
