import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useMe } from '@/auth/AuthGate';
import { signOut } from '@/lib/authClient';
import type { Role } from '@/config/menu';

export function AppLayout() {
  const me = useMe();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  const role: Role = me?.role ?? 'school_admin';

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar role={role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          userName={me?.name ?? '—'}
          schoolName={me?.school_name ?? '—'}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
