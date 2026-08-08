import { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { IdleCountdown } from './IdleCountdown';
import { useMe } from '@/auth/AuthGate';
import { signOut } from '@/lib/authClient';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { UnreadMessagesProvider } from '@/hooks/useUnreadMessages';
import type { Role } from '@/config/menu';

// Encerra a sessão após 20 min sem interação; a contagem aparece nos últimos 2 min.
const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const IDLE_WARNING_MS = 2 * 60 * 1000;

export function AppLayout() {
  const me = useMe();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    await signOut();
    navigate('/login', { replace: true });
  }, [navigate]);

  const { warning, secondsLeft, reset } = useIdleTimer({
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onExpire: () => { handleLogout(); },
  });

  const role: Role = me?.role ?? 'school_admin';

  return (
    <UnreadMessagesProvider>
      <div className="flex h-screen overflow-hidden bg-canvas">
        <Sidebar role={role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar
            userName={me?.name ?? '—'}
            schoolName={me?.school_name ?? '—'}
            role={me?.role}
            onMenuClick={() => setSidebarOpen(true)}
            onLogout={handleLogout}
          />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
        {warning && (
          <IdleCountdown secondsLeft={secondsLeft} onStay={reset} onLogout={handleLogout} />
        )}
      </div>
    </UnreadMessagesProvider>
  );
}
