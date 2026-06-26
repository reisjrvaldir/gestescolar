import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, Send, Plus, Loader2, Inbox, FileText } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { messagesService, type Message, type Contact, type NewMessage } from '@/services/messages';

export function MessagesPage() {
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState<Message | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewMessage>();

  useEffect(() => { load(); }, [tab]);

  async function load() {
    setLoading(true);
    try {
      const [msgs, ctcs] = await Promise.all([
        messagesService.list(tab),
        messagesService.contacts(),
      ]);
      setMessages(msgs);
      setContacts(ctcs);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onSend(data: NewMessage) {
    await messagesService.send(data);
    reset();
    setOpen(false);
    await load();
  }

  async function openRead(m: Message) {
    setReading(m);
    if (!m.read_at && tab === 'inbox') {
      await messagesService.markRead(m.id);
      setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x));
    }
  }

  return (
    <>
      <PageHeader
        title="Mensagens"
        subtitle="Comunique-se com a escola, professores e responsáveis."
        actions={
          <button className="btn-primary" onClick={() => { reset(); setOpen(true); }}>
            <Plus size={16} /> Nova mensagem
          </button>
        }
      />

      <div className="mb-4 flex gap-2">
        <button className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'inbox' ? 'bg-primary text-white' : 'bg-surface text-ink-muted hover:bg-canvas'}`} onClick={() => setTab('inbox')}>
          <Inbox size={14} /> Recebidas
        </button>
        <button className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'sent' ? 'bg-primary text-white' : 'bg-surface text-ink-muted hover:bg-canvas'}`} onClick={() => setTab('sent')}>
          <Send size={14} /> Enviadas
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-ink-muted"><Loader2 className="animate-spin" size={16} /> Carregando…</div>
        ) : messages.length === 0 ? (
          <EmptyState icon={Mail} title={tab === 'inbox' ? 'Caixa vazia' : 'Nenhuma mensagem enviada'} description="Use o botão acima para enviar uma mensagem." />
        ) : (
          <ul className="divide-y divide-border">
            {messages.map((m) => (
              <li key={m.id}
                  className={`cursor-pointer px-4 py-3 hover:bg-canvas ${tab === 'inbox' && !m.read_at ? 'bg-primary-soft/30' : ''}`}
                  onClick={() => openRead(m)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-sm ${tab === 'inbox' && !m.read_at ? 'font-bold text-ink' : 'font-medium text-ink-muted'}`}>
                        {tab === 'inbox' ? m.sender_name : `Para: ${m.recipient_name}`}
                      </p>
                      {tab === 'inbox' && !m.read_at && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <p className="truncate text-sm text-ink">{m.subject}</p>
                    {m.student_name && <p className="truncate text-xs text-ink-subtle">Sobre: {m.student_name}</p>}
                  </div>
                  <span className="whitespace-nowrap text-xs text-ink-subtle">{new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={open} title="Nova mensagem" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" form="message-form" type="submit"><Send size={14} /> Enviar</button>
          </>
        }>
        <form id="message-form" className="space-y-3" onSubmit={handleSubmit(onSend)}>
          <div>
            <label className="label">Destinatário *</label>
            <select className="input" {...register('recipient_id', { required: 'Selecione' })}>
              <option value="">— Selecione —</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
            </select>
            {errors.recipient_id && <p className="mt-1 text-xs text-danger">{errors.recipient_id.message}</p>}
          </div>
          <div>
            <label className="label">Assunto *</label>
            <input className="input" {...register('subject', { required: 'Informe o assunto' })} />
            {errors.subject && <p className="mt-1 text-xs text-danger">{errors.subject.message}</p>}
          </div>
          <div>
            <label className="label">Mensagem *</label>
            <textarea className="input min-h-[140px]" {...register('body', { required: 'Escreva uma mensagem' })} />
            {errors.body && <p className="mt-1 text-xs text-danger">{errors.body.message}</p>}
          </div>
        </form>
      </Modal>

      <Modal open={!!reading} title={reading?.subject ?? ''} onClose={() => setReading(null)}
        footer={<button className="btn-primary" onClick={() => setReading(null)}>Fechar</button>}>
        {reading && (
          <div className="space-y-2 text-sm">
            <p className="text-xs text-ink-muted">
              {tab === 'inbox' ? `De: ${reading.sender_name}` : `Para: ${reading.recipient_name}`}
              {' • '}{new Date(reading.created_at).toLocaleString('pt-BR')}
            </p>
            {reading.student_name && (
              <p className="rounded-lg bg-canvas px-2 py-1 text-xs text-ink-muted">
                <FileText size={12} className="mr-1 inline" /> Sobre: {reading.student_name}
              </p>
            )}
            <p className="whitespace-pre-wrap text-ink">{reading.body}</p>
          </div>
        )}
      </Modal>
    </>
  );
}
