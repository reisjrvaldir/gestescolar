import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { GraduationCap, X, ChevronDown } from 'lucide-react';
import { MENUS, type Role } from '@/config/menu';

interface Props {
  role: Role;
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'ges_sidebar_collapsed';

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function Sidebar({ role, open, onClose }: Props) {
  const sections = MENUS[role] ?? [];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  function toggle(title: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed z-40 flex h-full w-64 flex-col border-r border-border bg-surface
          transition-transform lg:static lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-sm font-extrabold leading-none text-ink">GestEscolar</p>
              <p className="text-[11px] text-ink-subtle">Gestão Educacional</p>
            </div>
          </div>
          <button className="lg:hidden text-ink-muted" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
          {sections.map((section, i) => {
            const isCollapsed = section.title ? collapsed[section.title] : false;
            return (
              <div key={section.title ?? `sec-${i}`} className="space-y-1">
                {section.title && (
                  <button
                    type="button"
                    onClick={() => toggle(section.title!)}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-subtle transition-colors hover:text-ink-muted"
                  >
                    {section.title}
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                  </button>
                )}
                {!isCollapsed && section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/app'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
                      ${isActive
                        ? 'bg-primary-soft text-primary'
                        : 'text-ink-muted hover:bg-canvas hover:text-ink'}`
                    }
                  >
                    <item.icon size={18} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
