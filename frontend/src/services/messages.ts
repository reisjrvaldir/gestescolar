import { api } from '@/lib/api';

export interface Message {
  id: string;
  subject: string;
  body: string;
  created_at: string;
  read_at: string | null;
  student_id?: string;
  sender_name: string;
  recipient_name: string;
  student_name?: string;
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

export const messagesService = {
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
  async markRead(id: string): Promise<void> {
    await api.patch(`/messages/${id}/read`);
  },
};
