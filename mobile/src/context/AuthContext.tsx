import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '@/lib/storage';
import { API_URL, AUTH_URL } from '@/lib/api';

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
}

interface AuthState {
  me: Me | null;
  token: string | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  me: null, token: null, loading: true,
  signIn: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, m] = await Promise.all([storage.getToken(), storage.getMe()]);
      if (t && m) { setToken(t); setMe(m as Me); }
      setLoading(false);
    })();
  }, []);

  async function signIn(identifier: string, password: string) {
    // Se parece com matrícula (F + números), busca o e-mail primeiro
    let email = identifier;
    if (/^F\d+$/i.test(identifier.trim())) {
      const r = await fetch(`${API_URL}/api/public/login-email?matricula=${encodeURIComponent(identifier.trim())}`);
      const d = await r.json();
      if (!r.ok || !d.email) throw new Error('Matrícula não encontrada');
      email = d.email;
    }

    // Better Auth sign-in
    const res = await fetch(`${AUTH_URL}/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message ?? 'Credenciais inválidas');

    const tok: string = data?.token ?? data?.data?.token;
    if (!tok) throw new Error('Token não recebido');

    // Busca perfil /api/me
    const meRes = await fetch(`${API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const meData = await meRes.json();
    if (!meRes.ok) throw new Error('Erro ao carregar perfil');

    const profile: Me = meData.data ?? meData;
    await Promise.all([storage.setToken(tok), storage.setMe(profile)]);
    setToken(tok);
    setMe(profile);
  }

  async function signOut() {
    await Promise.all([storage.clearToken(), storage.clearMe()]);
    setToken(null);
    setMe(null);
  }

  return (
    <AuthContext.Provider value={{ me, token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
export function useMe() { return useContext(AuthContext).me; }
