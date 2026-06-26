import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/lib/authClient';
import { api } from '@/lib/api';
import type { Role } from '@/config/menu';

export interface Me {
  name: string;
  email: string;
  role: Role;
  school_id: string;
  school_name: string;
  school_status: string;
  password_change_required?: boolean;
}

interface MeResponse {
  authenticated: boolean;
  hasProfile: boolean;
  email?: string;
  profile?: Me;
}

const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext);

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-canvas">
      <Loader2 className="animate-spin text-primary" size={28} />
    </div>
  );
}

/** Protege o /app: exige sessão Better Auth + perfil. Sem perfil → onboarding.
 *  Se senha ainda for a inicial (password_change_required), redireciona pra troca. */
export function AuthGate() {
  const { data: session, isPending } = useSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (isPending) return;
    if (!session) { setLoadingMe(false); return; }
    let active = true;
    api.get<MeResponse>('/me')
      .then((r) => { if (active) setMe(r); })
      .catch(() => { if (active) setMe(null); })
      .finally(() => { if (active) setLoadingMe(false); });
    return () => { active = false; };
  }, [session, isPending]);

  if (isPending || loadingMe) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (me && !me.hasProfile) return <Navigate to="/onboarding" replace />;
  if (!me?.profile) return <FullScreenLoader />;

  // Troca obrigatória de senha — bloqueia tudo até trocar.
  if (me.profile.password_change_required && location.pathname !== '/app/change-password') {
    return <Navigate to="/app/change-password" replace />;
  }

  return (
    <MeContext.Provider value={me.profile}>
      <Outlet />
    </MeContext.Provider>
  );
}
