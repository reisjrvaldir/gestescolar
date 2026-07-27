import { useState, useRef, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, AlertTriangle, GraduationCap, Users, BookOpen, Receipt, LifeBuoy, User } from 'lucide-react';
import { api } from '@/lib/api';

export interface SearchResult {
  id: string;
  name: string;
  context: string | null;
  type: 'student' | 'guardian' | 'teacher' | 'class' | 'invoice' | 'ticket';
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; route: string }> = {
  student:  { label: 'Alunos',       icon: GraduationCap, route: '/app/students' },
  guardian: { label: 'Responsáveis', icon: Users,         route: '/app/students' },
  teacher:  { label: 'Funcionários', icon: User,          route: '/app/staff' },
  class:    { label: 'Turmas',       icon: BookOpen,      route: '/app/classes' },
  invoice:  { label: 'Cobranças',    icon: Receipt,       route: '/app/finance/receivables' },
  ticket:   { label: 'Chamados',     icon: LifeBuoy,      route: '/app/tickets' },
};

const TYPE_ORDER = ['student', 'guardian', 'teacher', 'class', 'invoice', 'ticket'];

type SearchState = 'idle' | 'loading' | 'done' | 'error';

function groupResults(results: SearchResult[]) {
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    if (!map.has(r.type)) map.set(r.type, []);
    map.get(r.type)!.push(r);
  }
  return TYPE_ORDER.filter((t) => map.has(t)).map((t) => ({
    type: t,
    label: TYPE_META[t].label,
    icon: TYPE_META[t].icon,
    items: map.get(t)!,
  }));
}

export function SearchBar() {
  const navigate = useNavigate();
  const listId = useId();
  const activeOptionId = useId();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<SearchState>('idle');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, []);

  function close() {
    setOpen(false);
    setCursor(-1);
  }

  function doSearch(q: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus('loading');
    setCursor(-1);
    setOpen(true);

    api.get<{ data: SearchResult[] }>(`/search?q=${encodeURIComponent(q)}`, ctrl.signal)
      .then((r) => {
        if (ctrl.signal.aborted) return;
        setResults(r.data);
        setStatus('done');
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setStatus('error');
      });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.trim().length < 2) {
      close();
      setStatus('idle');
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(() => doSearch(v.trim()), 400);
  }

  function selectResult(r: SearchResult) {
    navigate(TYPE_META[r.type].route);
    setQuery('');
    setResults([]);
    setStatus('idle');
    close();
    inputRef.current?.blur();
  }

  // Build flat list once per render for indexed keyboard navigation
  const groups = groupResults(results);
  const flat: SearchResult[] = [];
  for (const g of groups) flat.push(...g.items);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'Escape') { setQuery(''); setStatus('idle'); setResults([]); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (c <= 0 ? -1 : c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cursor >= 0 && flat[cursor]) selectResult(flat[cursor]);
      else if (flat.length > 0) selectResult(flat[0]);
    } else if (e.key === 'Escape') {
      close();
    }
  }

  const showDropdown = open && status !== 'idle';
  const cursorOptionId = cursor >= 0 ? `${activeOptionId}-${cursor}` : undefined;

  return (
    <div ref={containerRef} className="relative hidden flex-1 max-w-md sm:block">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ink-subtle"
      />
      {status === 'loading' && (
        <Loader2
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 animate-spin text-ink-subtle"
        />
      )}

      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? listId : undefined}
        aria-activedescendant={cursorOptionId}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-label="Busca global"
        className="input pl-9 pr-8"
        placeholder="Buscar alunos, turmas, faturas…"
        value={query}
        autoComplete="off"
        spellCheck={false}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0 || status === 'loading') setOpen(true); }}
      />

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          aria-label="Resultados da busca"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-border bg-surface shadow-card-hover"
        >
          {/* Estado: carregando */}
          {status === 'loading' && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-muted">
              <Loader2 size={14} className="animate-spin" /> Buscando…
            </div>
          )}

          {/* Estado: erro */}
          {status === 'error' && (
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-danger">
                <AlertTriangle size={14} /> Falha na busca.
              </span>
              <button
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => doSearch(query.trim())}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Estado: sem resultados */}
          {status === 'done' && flat.length === 0 && (
            <div className="px-4 py-3 text-sm text-ink-muted">
              Nenhum resultado para <strong>"{query}"</strong>.
            </div>
          )}

          {/* Resultados agrupados */}
          {status === 'done' && flat.length > 0 && (() => {
            let absIdx = 0;
            return groups.map(({ type, label, icon: Icon, items }) => (
              <div key={type}>
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                  <Icon size={10} />
                  {label}
                </div>
                {items.map((item) => {
                  const itemIdx = absIdx++;
                  const isActive = itemIdx === cursor;
                  const optionId = `${activeOptionId}-${itemIdx}`;
                  return (
                    <div
                      key={item.id}
                      id={optionId}
                      role="option"
                      aria-selected={isActive}
                      className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-ink hover:bg-canvas'
                      }`}
                      onMouseDown={(e) => { e.preventDefault(); selectResult(item); }}
                      onMouseEnter={() => setCursor(itemIdx)}
                    >
                      <span className="truncate font-medium">{item.name}</span>
                      {item.context && (
                        <span className="ml-3 shrink-0 text-xs text-ink-subtle">{item.context}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
