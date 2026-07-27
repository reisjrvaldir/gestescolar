import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu, ChevronDown, LogOut, Settings, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { ROLE_LABELS } from '@/types/models';

interface Props {
  userName: string;
  schoolName: string;
  role?: string;
  onMenuClick: () => void;
  onLogout?: () => void;
}

interface AccountLink { to: string; label: string; icon: LucideIcon }

function accountLinksFor(role?: string): AccountLink[] {
  const links: AccountLink[] = [];
  if (role === 'school_admin') links.push({ to: '/app/settings', label: 'Configurações', icon: Settings });
  if (role === 'superadmin') links.push({ to: '/app/profile', label: 'Meu Perfil', icon: Settings });
  if (role && role !== 'superadmin') links.push({ to: '/app/lgpd', label: 'Meus Dados (LGPD)', icon: ShieldCheck });
  return links;
}

export function Topbar({ userName, schoolName, role, onMenuClick, onLogout }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = userName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  const roleLabel = role ? ROLE_LABELS[role] ?? role : '';
  const accountLinks = accountLinksFor(role);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur lg:px-6">
      <button className="lg:hidden text-ink-muted" onClick={onMenuClick} aria-label="Abrir menu">
        <Menu size={22} aria-hidden="true" />
      </button>

      {/* Busca global — oculta para responsável (acesso limitado ao próprio filho) */}
      {role !== 'guardian' && <SearchBar />}

      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
        {/* Escola atual (sem seta — não é um menu) */}
        <div className="hidden items-center rounded-xl border border-border px-3 py-2 text-sm font-medium text-ink md:flex">
          {schoolName}
        </div>

        {/* Notificações */}
        <button className="relative rounded-xl p-2 text-ink-muted hover:bg-canvas" aria-label="Notificações">
          <Bell size={20} aria-hidden="true" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
        </button>

        {/* Avatar + nome + menu de conta */}
        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-canvas"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Menu da conta de ${userName}`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary" aria-hidden="true">
              {initials || '?'}
            </div>
            <div className="hidden text-left sm:block">
              <span className="block text-sm font-semibold leading-tight text-ink">{userName}</span>
              {roleLabel && <span className="block text-[11px] leading-tight text-ink-subtle">{roleLabel}</span>}
            </div>
            <ChevronDown size={15} className="hidden text-ink-subtle sm:block" aria-hidden="true" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div role="menu" className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-border bg-surface py-1 shadow-card-hover">
                {accountLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-canvas"
                    onClick={() => setMenuOpen(false)}
                  >
                    <link.icon size={15} aria-hidden="true" /> {link.label}
                  </Link>
                ))}
                {accountLinks.length > 0 && <div className="my-1 border-t border-border" role="separator" />}
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-soft"
                  onClick={() => { setMenuOpen(false); onLogout?.(); }}
                >
                  <LogOut size={15} aria-hidden="true" /> Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
