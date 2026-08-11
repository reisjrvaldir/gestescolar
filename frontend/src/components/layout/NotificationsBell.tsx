import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Loader2, Inbox } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationsService, type Notification } from '@/services/notifications';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationsBell() {
  const { count, refresh } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    notificationsService.list().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function openNotification(n: Notification) {
    if (!n.read_at) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)));
      notificationsService.markRead(n.id).then(refresh).catch(() => {});
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  async function markAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    try { await notificationsService.markAllRead(); refresh(); } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="relative rounded-xl p-2 text-ink-muted hover:bg-canvas"
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={20} aria-hidden="true" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-border bg-surface shadow-card-hover">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold text-ink">Notificações</h3>
            {items.some((i) => !i.read_at) && (
              <button className="flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={markAllRead}>
                <Check size={12} /> Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8 text-ink-muted"><Loader2 className="animate-spin" size={18} /></div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-ink-muted">
                <Inbox size={28} className="opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  className={`flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-canvas ${!n.read_at ? 'bg-primary-soft/20' : ''}`}
                  onClick={() => openNotification(n)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm ${!n.read_at ? 'font-bold text-ink' : 'font-medium text-ink'}`}>{n.title}</span>
                    <span className="shrink-0 text-[10px] text-ink-subtle">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.body && <p className="truncate text-xs text-ink-muted">{n.body}</p>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
