import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Menu, X } from 'lucide-react';

const NAV = [
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Planos', href: '#planos' },
  { label: 'Contato', href: '#contato' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="#topo" className="flex items-center gap-2" aria-label="GestEscolar">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
            <GraduationCap size={20} />
          </div>
          <span className="text-lg font-extrabold text-ink">GestEscolar</span>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-muted lg:flex">
          {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-ink">{n.label}</a>)}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/login" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas">Entrar</Link>
          <Link to="/login" className="rounded-xl bg-cta px-4 py-2 text-sm font-semibold text-white hover:bg-cta-hover">Teste grátis</Link>
        </div>

        <button className="lg:hidden text-ink" onClick={() => setOpen((v) => !v)} aria-label="Abrir menu">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-surface lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 text-sm font-medium text-ink-muted hover:bg-canvas">{n.label}</a>
            ))}
            <div className="mt-2 flex gap-2">
              <Link to="/login" className="flex-1 rounded-xl border border-border px-4 py-2 text-center text-sm font-semibold text-ink">Entrar</Link>
              <Link to="/login" className="flex-1 rounded-xl bg-cta px-4 py-2 text-center text-sm font-semibold text-white">Teste grátis</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
