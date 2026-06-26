import { useState } from 'react';
import { Search, Bell, Menu, ChevronDown, LogOut } from 'lucide-react';

interface Props {
  userName: string;
  schoolName: string;
  onMenuClick: () => void;
  onLogout?: () => void;
}

export function Topbar({ userName, schoolName, onMenuClick, onLogout }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = userName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur lg:px-6">
      <button className="lg:hidden text-ink-muted" onClick={onMenuClick}>
        <Menu size={22} />
      </button>

      {/* Busca */}
      <div className="relative hidden flex-1 max-w-md sm:block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
        <input className="input pl-9" placeholder="Buscar alunos, turmas, faturas..." />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
        {/* Seletor de escola */}
        <button className="hidden items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-canvas md:flex">
          {schoolName}
          <ChevronDown size={15} className="text-ink-subtle" />
        </button>

        {/* Notificações */}
        <button className="relative rounded-xl p-2 text-ink-muted hover:bg-canvas">
          <Bell size={20} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
        </button>

        {/* Avatar + nome + menu de conta */}
        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-canvas"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
              {initials || '?'}
            </div>
            <span className="hidden text-sm font-medium text-ink sm:block">{userName}</span>
            <ChevronDown size={15} className="hidden text-ink-subtle sm:block" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-border bg-surface py-1 shadow-card-hover">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-canvas"
                  onClick={() => { setMenuOpen(false); onLogout?.(); }}
                >
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
