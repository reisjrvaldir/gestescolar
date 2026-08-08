import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { messagesService } from '@/services/messages';

interface UnreadMessagesValue {
  count: number;
  refresh: () => void;
}

const UnreadMessagesContext = createContext<UnreadMessagesValue>({ count: 0, refresh: () => {} });

const POLL_MS = 25_000;

/** Badge de mensagens não lidas no menu lateral, para todos os perfis. */
export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    messagesService.unreadCount().then(setCount).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <UnreadMessagesContext.Provider value={{ count, refresh }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext);
}
