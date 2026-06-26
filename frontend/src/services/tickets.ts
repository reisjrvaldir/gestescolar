import { api } from '@/lib/api';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'reopened' | 'closed';
  priority?: string;
  category?: string;
  opened_by_name: string;
  created_at: string;
}

export interface TicketComment {
  id: string;
  message: string;
  user_name: string;
  created_at: string;
}

export interface TicketDetail extends Ticket {
  comments: TicketComment[];
}

export async function listTickets(): Promise<Ticket[]> {
  const r = await api.get<{ data: Ticket[] }>('/tickets');
  return r.data;
}

export async function getTicket(id: string): Promise<TicketDetail> {
  const r = await api.get<{ data: TicketDetail }>(`/tickets/${id}`);
  return r.data;
}

export async function createTicket(data: { title: string; description: string }): Promise<Ticket> {
  const r = await api.post<{ data: Ticket }>('/tickets', data);
  return r.data;
}

export async function addComment(ticketId: string, message: string): Promise<TicketComment> {
  const r = await api.post<{ data: TicketComment }>(`/tickets/${ticketId}/comments`, { message });
  return r.data;
}

export async function closeTicket(id: string): Promise<void> {
  await api.patch(`/tickets/${id}/close`);
}
