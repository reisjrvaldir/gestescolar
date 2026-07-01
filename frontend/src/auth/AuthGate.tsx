import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useSession, signOut } from '@/lib/authClient';
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
  subscription_status?: string | null;
  trial_ends_at?: string | null;
}

/** Assinatura inativa = past_due/canceled, ou trial já vencido. */
function isSubscriptionInactive(me: Me): boolean {
  if (me.role === 'superadmin') return false;
  const status = me.subscription_status ?? 'trialing';
  if (status === 'past_due' || status === 'canceled') return true;
  if (status === 'trialing' && me.trial_ends_at) {
    return new Date(me.trial_ends_at).getTime() < Date.now();
  }
  return false;
}

function SubscriptionBlocked({ me }: { me: Me }) {
  const isAdmin = me.role === 'school_admin';
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="card w-full max-w-md p-7 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-warning">
          <ShieldAlert size={28} />
        </div>
        <h1 className="text-lg font-bold text-ink">Assinatura expirada</h1>
        <p className="mt-2 text-sm text-ink-muted">
          O período de teste ou a assinatura da <strong>{me.school_name}</strong> não está mais ativo.
          Para continuar usando o GestEscolar, é necessário regularizar o pagamento.
        </p>
        {isAdmin ? (
          <Link to="/app/settings" className="btn-primary mt-5 w-full justify-center">Ver planos e regularizar</Link>
        ) : (
          <p className="mt-5 rounded-xl bg-canvas p-3 text-xs text-ink-muted">
            Fale com a gestão da escola para regularizar o acesso.
          </p>
        )}
        <button
          className="mt-3 w-full text-center text-xs text-ink-subtle hover:text-ink-muted"
          onClick={() => signOut().then(() => { window.location.href = '/login'; })}
        >
          Sair
        </button>
      </div>
    </div>
  );
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

  // Paywall: assinatura inativa bloqueia o app (exceto Configurações p/ regularizar).
  if (isSubscriptionInactive(me.profile) && location.pathname !== '/app/settings') {
    return <SubscriptionBlocked me={me.profile} />;
  }

  return (
    <MeContext.Provider value={me.profile}>
      <Outlet />
    </MeContext.Provider>
  );
}
