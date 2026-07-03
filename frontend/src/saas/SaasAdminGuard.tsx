import { Navigate, Outlet } from 'react-router-dom';
import { useSaasAdmin } from './useSaasAdmin';

/**
 * Guard exclusivo do módulo Super Admin: só role 'superadmin' entra.
 * Usuários da escola (school_admin, financial, teacher, guardian) são
 * redirecionados para /app. Fica fora do <AppLayout> — layout próprio.
 */
export function SaasAdminGuard() {
  const { me, isSuperAdmin } = useSaasAdmin();
  if (!me) return null; // AuthGate cuida do carregamento
  if (!isSuperAdmin) return <Navigate to="/app" replace />;
  return <Outlet />;
}
