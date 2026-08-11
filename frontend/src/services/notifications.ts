import { api } from '@/lib/api';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationsService = {
  async list(): Promise<Notification[]> {
    const r = await api.get<{ ok: boolean; data: Notification[] }>('/notifications');
    return r.data;
  },
  async unreadCount(): Promise<number> {
    const r = await api.get<{ ok: boolean; data: { count: number } }>('/notifications/unread-count');
    return r.data.count;
  },
  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },
  async markAllRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },
};
