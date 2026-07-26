import { useEffect, useRef, useState } from 'react';
import {
  Send, Plus, Loader2, ArrowLeft, Search, Users, User, MessageCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { messagesService, type Thread, type Message, type Contact } from '@/services/messages';
import { classesService } from '@/services/classes';
import type { SchoolClass } from '@/types/models';
import { useMe } from '@/auth/AuthGate';

const ROLE_LABEL: Record<string, string> = {
  school_admin: 'Gestão',
  teacher: 'Professor',
  guardian: 'Responsável',
  financial: 'Financeiro',
  superadmin: 'Super Admin',
};

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDateSep(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hoje';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function MessagesPage() {
  const me = useMe();
  const canBroadcast = me && ['school_admin', 'teacher', 'superadmin'].includes(me.role);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Mobile: 'list' | 'chat'
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Modal nova conversa
  const [newOpen, setNewOpen] = useState(false);
  const [newMode, setNewMode] = useState<'individual' | 'turma' | 'todos'>('individual');
  const [newRecipient, setNewRecipient] = useState('');
  const [newClass, setNewClass] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newSending, setNewSending] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadThreads(); }, []);
  useEffect(() => {
    if (canBroadcast) classesService.list().then(setClasses).catch(() => {});
    messagesService.contacts().then(setContacts).catch(() => {});
  }, []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadThreads() {
    setLoading(true);
    try { setThreads(await messagesService.threads()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function openThread(thread: Thread) {
    setActiveThread(thread);
    setMobileView('chat');
    setChatLoading(true);
    try {
      const msgs = await messagesService.thread(thread.partner_id);
      setMessages(msgs);
      setThreads(prev => prev.map(t =>
        t.partner_id === thread.partner_id ? { ...t, unread_count: 0 } : t,
      ));
    } catch (e) { console.error(e); }
    setChatLoading(false);
  }

  async function sendMessage() {
    if (!activeThread || !body.trim() || sending) return;
    setSending(true);
    try {
      const msg = await messagesService.send({
        recipient_id: activeThread.partner_id,
        subject: 'Chat',
        body: body.trim(),
      });
      setMessages(prev => [...prev, { ...msg, sender_id: me?.profile_id ?? '', recipient_id: activeThread.partner_id, sender_name: me?.name ?? 'Eu', recipient_name: activeThread.partner_name }]);
      setThreads(prev => {
        const exists = prev.find(t => t.partner_id === activeThread.partner_id);
        const updated: Thread = {
          ...activeThread,
          last_body: body.trim(),
          last_at: new Date().toISOString(),
          is_mine: true,
          unread_count: 0,
        };
        if (exists) return [updated, ...prev.filter(t => t.partner_id !== activeThread.partner_id)];
        return [updated, ...prev];
      });
      setBody('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (e) { console.error(e); }
    setSending(false);
  }

  async function sendNewConversation() {
    if (newSending) return;
    if (newMode === 'individual' && !newRecipient) return;
    if (!newBody.trim()) return;
    setNewSending(true);
    try {
      if (newMode === 'individual') {
        const contact = contacts.find(c => c.id === newRecipient);
        await messagesService.send({ recipient_id: newRecipient, subject: newSubject || 'Nova mensagem', body: newBody });
        const thread: Thread = {
          partner_id: newRecipient,
          partner_name: contact?.name ?? '',
          partner_role: contact?.role ?? '',
          last_body: newBody,
          last_subject: newSubject || 'Nova mensagem',
          is_mine: true,
          last_at: new Date().toISOString(),
          unread_count: 0,
        };
        setThreads(prev => [thread, ...prev.filter(t => t.partner_id !== newRecipient)]);
        setNewOpen(false);
        setNewBody(''); setNewSubject(''); setNewRecipient('');
        openThread(thread);
      } else {
        await messagesService.broadcast({
          subject: newSubject || 'Aviso escolar',
          body: newBody,
          class_id: newMode === 'turma' ? newClass : undefined,
        });
        setNewOpen(false);
        setNewBody(''); setNewSubject(''); setNewClass('');
        await loadThreads();
      }
    } catch (e) { console.error(e); }
    setNewSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  const filteredThreads = threads.filter(t =>
    t.partner_name.toLowerCase().includes(search.toLowerCase()),
  );

  // Group messages by date
  const groupedMessages: { sep: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const sep = formatDateSep(msg.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.sep === sep) last.msgs.push(msg);
    else groupedMessages.push({ sep, msgs: [msg] });
  }

  return (
    <>
      {/* Layout: esquerda (lista) + direita (chat) */}
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-card">

        {/* PAINEL ESQUERDO: lista de conversas */}
        <div className={`
          flex w-full flex-col border-r border-border md:w-72 lg:w-80
          ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
        `}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-bold text-ink">Mensagens</h2>
            <button
              className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white hover:bg-primary/90"
              title="Nova conversa"
              onClick={() => { setNewOpen(true); setNewMode('individual'); setNewBody(''); setNewSubject(''); setNewRecipient(''); setNewClass(''); }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Busca */}
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm text-ink-muted">
              <Search size={14} />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none placeholder:text-ink-muted"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8 text-ink-muted"><Loader2 className="animate-spin" size={20} /></div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-ink-muted">
                <MessageCircle size={40} className="mb-2 opacity-30" />
                <p className="text-sm">Nenhuma conversa</p>
                <button className="mt-3 text-sm font-semibold text-primary" onClick={() => setNewOpen(true)}>
                  Iniciar nova conversa
                </button>
              </div>
            ) : (
              filteredThreads.map(thread => {
                const isActive = activeThread?.partner_id === thread.partner_id;
                return (
                  <button
                    key={thread.partner_id}
                    className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-canvas ${isActive ? 'bg-primary-soft/30' : ''}`}
                    onClick={() => openThread(thread)}
                  >
                    {/* Avatar */}
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {initials(thread.partner_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className={`truncate text-sm ${thread.unread_count > 0 ? 'font-bold text-ink' : 'font-medium text-ink'}`}>
                          {thread.partner_name}
                        </p>
                        <span className="shrink-0 text-[10px] text-ink-subtle">{formatTime(thread.last_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className={`flex-1 truncate text-xs ${thread.unread_count > 0 ? 'text-ink' : 'text-ink-muted'}`}>
                          {thread.is_mine && <span className="mr-0.5 text-ink-muted">Você: </span>}
                          {thread.last_body}
                        </p>
                        {thread.unread_count > 0 && (
                          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-ink-subtle">{ROLE_LABEL[thread.partner_role] ?? thread.partner_role}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* PAINEL DIREITO: chat */}
        <div className={`
          flex flex-1 flex-col
          ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
        `}>
          {!activeThread ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-muted">
              <MessageCircle size={56} className="opacity-20" />
              <p className="text-sm">Selecione uma conversa para começar</p>
            </div>
          ) : (
            <>
              {/* Header do chat */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-canvas md:hidden"
                  onClick={() => { setMobileView('list'); setActiveThread(null); }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {initials(activeThread.partner_name)}
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">{activeThread.partner_name}</p>
                  <p className="text-xs text-ink-muted">{ROLE_LABEL[activeThread.partner_role] ?? activeThread.partner_role}</p>
                </div>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {chatLoading ? (
                  <div className="flex justify-center py-8 text-ink-muted"><Loader2 className="animate-spin" size={20} /></div>
                ) : groupedMessages.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-ink-muted">
                    <MessageCircle size={40} className="mb-2 opacity-20" />
                    <p className="text-sm">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  groupedMessages.map(group => (
                    <div key={group.sep}>
                      {/* Separador de data */}
                      <div className="my-2 flex items-center gap-2">
                        <div className="flex-1 border-t border-border" />
                        <span className="rounded-full bg-canvas px-3 py-0.5 text-[11px] text-ink-muted">{group.sep}</span>
                        <div className="flex-1 border-t border-border" />
                      </div>
                      <div className="space-y-1">
                        {group.msgs.map(msg => {
                          const isMe = msg.sender_id === me?.profile_id;
                          return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`
                                max-w-[75%] rounded-2xl px-3 py-2 text-sm
                                ${isMe
                                  ? 'rounded-br-sm bg-primary text-white'
                                  : 'rounded-bl-sm bg-canvas text-ink border border-border'
                                }
                              `}>
                                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                                <p className={`mt-1 text-right text-[10px] ${isMe ? 'text-white/70' : 'text-ink-muted'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input bar */}
              <div className="border-t border-border px-4 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder="Digite uma mensagem…"
                    value={body}
                    onChange={autoResize}
                    onKeyDown={handleKeyDown}
                    className="flex-1 resize-none rounded-xl border border-border bg-canvas px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
                    style={{ maxHeight: '120px' }}
                  />
                  <button
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
                    onClick={sendMessage}
                    disabled={!body.trim() || sending}
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-ink-muted">Enter para enviar · Shift+Enter para nova linha</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL NOVA CONVERSA */}
      <Modal
        open={newOpen}
        title="Nova mensagem"
        onClose={() => setNewOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setNewOpen(false)}>Cancelar</button>
            <button
              className="btn-primary"
              onClick={sendNewConversation}
              disabled={newSending || !newBody.trim() || (newMode === 'individual' && !newRecipient) || (newMode === 'turma' && !newClass)}
            >
              {newSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Tipo de envio */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'individual', label: 'Individual', icon: User },
              ...(canBroadcast ? [{ key: 'turma', label: 'Turma', icon: Users }, { key: 'todos', label: 'Todos', icon: MessageCircle }] : []),
            ] as { key: 'individual' | 'turma' | 'todos'; label: string; icon: typeof User }[]).map(opt => (
              <button
                key={opt.key}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-xs font-semibold transition-colors ${
                  newMode === opt.key ? 'border-primary bg-primary-soft text-primary' : 'border-border text-ink-muted hover:border-primary/40'
                }`}
                onClick={() => setNewMode(opt.key)}
              >
                <opt.icon size={18} />
                {opt.label}
              </button>
            ))}
          </div>

          {newMode === 'individual' && (
            <div>
              <label className="label">Destinatário *</label>
              <select className="input" value={newRecipient} onChange={e => setNewRecipient(e.target.value)}>
                <option value="">— Selecione —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({ROLE_LABEL[c.role] ?? c.role})</option>)}
              </select>
            </div>
          )}

          {newMode === 'turma' && (
            <div>
              <label className="label">Turma *</label>
              <select className="input" value={newClass} onChange={e => setNewClass(e.target.value)}>
                <option value="">— Selecione a turma —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {newMode === 'todos' && (
            <p className="rounded-xl bg-primary-soft/40 px-3 py-2 text-sm text-primary">
              A mensagem será enviada para todos os responsáveis com acesso ao sistema.
            </p>
          )}

          <div>
            <label className="label">Assunto</label>
            <input className="input" placeholder="Opcional" value={newSubject} onChange={e => setNewSubject(e.target.value)} />
          </div>
          <div>
            <label className="label">Mensagem *</label>
            <textarea
              className="input min-h-[100px] resize-none"
              placeholder="Digite a mensagem..."
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
