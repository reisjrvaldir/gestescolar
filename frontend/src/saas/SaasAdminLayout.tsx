import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, School2, Package, CalendarClock,
  Users, Activity, Wallet, ArrowLeftRight, Receipt,
  LifeBuoy, Search,
  Bell as BellIcon, HelpCircle, Menu, X, ChevronDown, LogOut, Crown,
  ArrowLeft, type LucideIcon,
} from 'lucide-react';
import { useSaasAdmin } from './useSaasAdmin';
import { signOut } from '@/lib/authClient';

interface NavGroup { title: string; items: { to: string; label: string; icon: LucideIcon }[] }

const NAV: NavGroup[] = [
  {
    title: 'Visão geral',
    items: [
      { to: '/saas', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Escolas',
    items: [
      { to: '/saas/escolas', label: 'Todas as escolas', icon: School2 },
      { to: '/saas/planos', label: 'Planos e assinaturas', icon: Package },
      { to: '/saas/vencimentos', label: 'Vencimentos', icon: CalendarClock },
    ],
  },
  {
    title: 'Usuários',
    items: [
      { to: '/saas/usuarios-escolas', label: 'Usuários das escolas', icon: Users },
      { to: '/saas/logs-acesso', label: 'Logs de acesso', icon: Activity },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { to: '/saas/receitas', label: 'Receitas do SaaS', icon: Wallet },
      { to: '/saas/repasses', label: 'Repasses para escolas', icon: ArrowLeftRight },
      { to: '/saas/transacoes', label: 'Cobranças e transações', icon: Receipt },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { to: '/saas/config/planos', label: 'Planos', icon: Package },
    ],
  },
];

const FOOTER_LINKS = [{ to: '/saas/suporte', label: 'Suporte ao cliente', icon: LifeBuoy }];

function SidebarLink({ to, label, icon: Icon, onClick }: { to: string; label: string; icon: LucideIcon; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/saas'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-white/10 text-white'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <Icon size={17} />
      {label}
    </NavLink>
  );
}

function SaasSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed z-40 flex h-full w-64 flex-col border-r border-slate-800 bg-[#0F172A]
          transition-transform lg:static lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple text-white">
              <Crown size={18} />
            </div>
            <div>
              <p className="text-sm font-extrabold leading-none text-white">GestEscolar</p>
              <p className="text-[11px] text-slate-400">Super Admin</p>
            </div>
          </div>
          <button className="text-slate-400 lg:hidden" onClick={onClose}><X size={20} /></button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
          {NAV.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.title}
              </p>
              {group.items.map((it) => <SidebarLink key={it.to} {...it} onClick={onClose} />)}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-3 space-y-1">
          {FOOTER_LINKS.map((it) => <SidebarLink key={it.to} {...it} onClick={onClose} />)}
          <NavLink to="/app" className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white">
            <ArrowLeft size={14} /> Voltar ao app da escola
          </NavLink>
        </div>
      </aside>
    </>
  );
}

function SaasTopbar({ userName, onMenuClick, onLogout }: { userName: string; onMenuClick: () => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const initials = userName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur lg:px-6">
      <button className="text-ink-muted lg:hidden" onClick={onMenuClick}><Menu size={22} /></button>

      <div className="relative hidden flex-1 max-w-lg sm:block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
        <input className="input pl-9" placeholder="Buscar escolas, usuários, planos, cobranças..." />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
        <button className="rounded-xl p-2 text-ink-muted hover:bg-canvas" title="Central de ajuda"><HelpCircle size={19} /></button>
        <button className="relative rounded-xl p-2 text-ink-muted hover:bg-canvas" title="Notificações">
          <BellIcon size={19} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
        </button>

        <div className="relative">
          <button className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-canvas" onClick={() => setOpen((v) => !v)}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple text-sm font-bold text-white">
              {initials || 'SA'}
            </div>
            <div className="hidden text-left sm:block">
              <span className="block text-sm font-semibold leading-tight text-ink">{userName}</span>
              <span className="block text-[11px] leading-tight text-ink-subtle">Administrador</span>
            </div>
            <ChevronDown size={15} className="hidden text-ink-subtle sm:block" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-border bg-surface py-1 shadow-card-hover">
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-soft" onClick={onLogout}>
                  <LogOut size={15} /> Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SaasAdminLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { me } = useSaasAdmin();

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <SaasSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <SaasTopbar userName={me?.name ?? 'Super Admin'} onMenuClick={() => setOpen(true)} onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
