// Endpoint público — não usa o client `api` (que anexa token de auth),
// pois o popup da landing roda sem sessão.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export interface NewLeadInput {
  name: string;
  email: string;
  phone?: string;
  school_name?: string;
  message?: string;
  source?: string;
}

export async function submitLead(body: NewLeadInput): Promise<void> {
  const res = await fetch(`${BASE}/public/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Não foi possível enviar. Tente novamente.');
  }
}
