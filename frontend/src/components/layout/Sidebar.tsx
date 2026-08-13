import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { GraduationCap, X, ChevronDown } from 'lucide-react';
import { MENUS, type Role } from '@/config/menu';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { isModuleEnabled, type EnabledModules } from '@shared/moduleCatalog';

interface Props {
  role: Role;
  enabledModules?: EnabledModules | null;
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

export function Sidebar({ role, enabledModules, open, onClose }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);
  const { count: unreadCount } = useUnreadMessages();

  // Aplica o filtro de módulos: itens sem `moduleKey` sempre aparecem (core);
  // itens com `moduleKey` só quando o módulo está ativo. Seções que ficam
  // sem itens depois do filtro são omitidas.
  const sections = useMemo(() => {
    const raw = MENUS[role] ?? [];
    return raw
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => !it.moduleKey || isModuleEnabled(enabledModules ?? undefined, it.moduleKey)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [role, enabledModules]);

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
            const hasTitle = !!section.title;
            return (
              <div key={section.title ?? `sec-${i}`} className="space-y-1" data-tour-section={section.title}>
                {hasTitle && (
                  <button
                    type="button"
                    onClick={() => toggle(section.title!)}
                    aria-expanded={!isCollapsed}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors
                      ${isCollapsed
                        ? 'text-ink-subtle hover:bg-canvas hover:text-ink-muted'
                        : 'bg-primary-soft/70 text-primary hover:bg-primary-soft'}`}
                  >
                    {section.title}
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                  </button>
                )}
                {!isCollapsed && (
                  <div className={hasTitle ? 'relative ml-3 space-y-1 border-l-2 border-primary/15 py-0.5 pl-3' : 'space-y-1'}>
                    {section.items.map((item) => {
                      const badge = item.to === '/app/messages' && unreadCount > 0 ? unreadCount : null;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.to === '/app'}
                          onClick={onClose}
                          data-tour-target={item.to === '/app/ajuda' ? 'ajuda' : undefined}
                          className={({ isActive }) =>
                            `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
                            ${isActive
                              ? 'bg-primary-soft text-primary'
                              : 'text-ink-muted hover:bg-canvas hover:text-ink'}`
                          }
                        >
                          {hasTitle && <span className="absolute -left-3 top-1/2 h-px w-3 bg-primary/15" aria-hidden="true" />}
                          <item.icon size={18} />
                          <span className="flex-1">{item.label}</span>
                          {badge !== null && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
