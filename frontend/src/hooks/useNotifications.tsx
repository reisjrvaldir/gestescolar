import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { notificationsService } from '@/services/notifications';

interface NotificationsValue {
  count: number;
  refresh: () => void;
}

const NotificationsContext = createContext<NotificationsValue>({ count: 0, refresh: () => {} });

const POLL_MS = 25_000;

/** Badge do sino no topo — mesmo padrão de useUnreadMessages. */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    notificationsService.unreadCount().then(setCount).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <NotificationsContext.Provider value={{ count, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
