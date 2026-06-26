import { Navigate } from 'react-router-dom';
import { useMe } from './AuthGate';
import type { Role } from '@/config/menu';

interface Props {
  allowed: Role[];
  children: React.ReactNode;
}

export function RoleGuard({ allowed, children }: Props) {
  const me = useMe();
  if (!me || !allowed.includes(me.role)) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}
