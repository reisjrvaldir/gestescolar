import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { MessageSquare, Plus, X, Send, Loader2, ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  listTickets, getTicket, createTicket, addComment, closeTicket,
  type Ticket, type TicketDetail,
} from '@/services/tickets';

export function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [commentText, setCommentText] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ title: string; description: string }>();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setTickets(await listTickets()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onCreate(data: { title: string; description: string }) {
    await createTicket(data);
    await load();
    reset();
    setOpen(false);
  }

  async function openDetail(id: string) {
    const d = await getTicket(id);
    setDetail(d);
  }

  async function onComment() {
    if (!detail || !commentText.trim()) return;
    await addComment(detail.id, commentText.trim());
    setCommentText('');
    const d = await getTicket(detail.id);
    setDetail(d);
  }

  async function onClose() {
    if (!detail) return;
    await closeTicket(detail.id);
    setDetail(null);
    await load();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  if (detail) {
    return (
      <>
        <button className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline" onClick={() => { setDetail(null); load(); }}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className="card p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">{detail.title}</h2>
              <p className="text-sm text-ink-muted">Aberto por {detail.opened_by_name} em {new Date(detail.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={detail.status === 'open' ? 'warning' : 'success'}>{detail.status === 'open' ? 'Aberto' : 'Fechado'}</StatusBadge>
              {detail.status === 'open' && (
                <button className="btn-outline text-xs" onClick={onClose}><X size={14} /> Fechar</button>
              )}
            </div>
          </div>
          <p className="mb-6 text-sm text-ink-muted whitespace-pre-wrap">{detail.description}</p>

          <h3 className="mb-3 text-sm font-semibold text-ink">Comentários</h3>
          <div className="mb-4 space-y-3">
            {detail.comments.length === 0 && <p className="text-sm text-ink-muted">Nenhum comentário ainda.</p>}
            {detail.comments.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-canvas p-3">
                <p className="text-sm text-ink">{c.message}</p>
                <p className="mt-1 text-xs text-ink-subtle">{c.user_name} — {new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            ))}
          </div>

          {detail.status === 'open' && (
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Escreva um comentário…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onComment()}
              />
              <button className="btn-primary" onClick={onComment}><Send size={16} /></button>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Chamados"
        subtitle="Abra e acompanhe solicitações de suporte."
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Novo chamado
          </button>
        }
      />

      <div className="card overflow-hidden">
        {tickets.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhum chamado"
            description="Abra o primeiro chamado de suporte."
            action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Novo chamado</button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                <th className="px-4 py-3">Assunto</th>
                <th className="px-4 py-3">Aberto por</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-canvas cursor-pointer" onClick={() => openDetail(t.id)}>
                  <td className="px-4 py-3 font-medium text-primary hover:underline">{t.title}</td>
                  <td className="px-4 py-3 text-ink-muted">{t.opened_by_name}</td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3"><StatusBadge tone={t.status === 'open' ? 'warning' : 'success'}>{t.status === 'open' ? 'Aberto' : 'Fechado'}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={open}
        title="Novo chamado"
        onClose={() => { reset(); setOpen(false); }}
        footer={
          <>
            <button className="btn-outline" onClick={() => { reset(); setOpen(false); }}>Cancelar</button>
            <button className="btn-primary" form="ticket-form" type="submit">Enviar</button>
          </>
        }
      >
        <form id="ticket-form" className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div>
            <label className="label">Assunto *</label>
            <input className="input" placeholder="Resumo do problema" {...register('title', { required: 'Informe o assunto' })} />
            {errors.title && <p className="mt-1 text-xs text-danger">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label">Descrição *</label>
            <textarea className="input min-h-[100px]" placeholder="Descreva detalhadamente…" {...register('description', { required: 'Informe a descrição' })} />
            {errors.description && <p className="mt-1 text-xs text-danger">{errors.description.message}</p>}
          </div>
        </form>
      </Modal>
    </>
  );
}
