import { api } from '@/lib/api';

export interface Message {
  id: string;
  subject: string;
  body: string;
  created_at: string;
  read_at: string | null;
  student_id?: string;
  sender_id: string;
  recipient_id: string;
  sender_name: string;
  recipient_name: string;
  student_name?: string;
}

export interface Thread {
  partner_id: string;
  partner_name: string;
  partner_role: string;
  last_body: string;
  last_subject: string;
  is_mine: boolean;
  last_at: string;
  unread_count: number;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface NewMessage {
  recipient_id: string;
  subject: string;
  body: string;
  student_id?: string;
}

export interface BroadcastMessage {
  subject: string;
  body: string;
  class_id?: string;
}

export const messagesService = {
  async threads(): Promise<Thread[]> {
    const r = await api.get<{ data: Thread[] }>('/messages/threads');
    return r.data;
  },
  async thread(partnerId: string): Promise<Message[]> {
    const r = await api.get<{ data: Message[] }>(`/messages/thread/${partnerId}`);
    return r.data;
  },
  async list(box: 'inbox' | 'sent' = 'inbox'): Promise<Message[]> {
    const r = await api.get<{ data: Message[] }>(`/messages?box=${box}`);
    return r.data;
  },
  async contacts(): Promise<Contact[]> {
    const r = await api.get<{ data: Contact[] }>('/messages/contacts');
    return r.data;
  },
  async send(m: NewMessage): Promise<Message> {
    const r = await api.post<{ data: Message }>('/messages', m);
    return r.data;
  },
  async broadcast(m: BroadcastMessage): Promise<{ sent: number }> {
    const r = await api.post<{ sent: number }>('/messages/broadcast', m);
    return r;
  },
  async markRead(id: string): Promise<void> {
    await api.patch(`/messages/${id}/read`);
  },
  async unreadCount(): Promise<number> {
    const r = await api.get<{ data: { count: number } }>('/messages/unread-count');
    return r.data.count;
  },
};
