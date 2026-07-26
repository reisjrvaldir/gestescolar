import { useEffect, useRef, useState } from 'react';
import {
  MessageSquare, Plus, X, Send, Loader2, ChevronLeft,
  Paperclip, ImagePlus, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  listTickets, getTicket, createTicket, addComment, closeTicket,
  type Ticket, type TicketDetail,
} from '@/services/tickets';

// ─── Categorias mapeando todo o menu do sistema ───────────────────────────────
const TICKET_CATEGORIES: { group: string; items: string[] }[] = [
  { group: 'Dashboard', items: ['Dashboard'] },
  {
    group: 'Gestão',
    items: ['Alunos', 'Funcionários', 'Turmas'],
  },
  {
    group: 'Acadêmico',
    items: ['Ano Letivo / Calendário', 'Lançar Notas', 'Boletim Escolar', 'Chamada / Frequência', 'Atestados'],
  },
  {
    group: 'Recursos Humanos',
    items: ['Ponto Eletrônico', 'Folgas e Férias', 'Documentos'],
  },
  {
    group: 'Financeiro',
    items: ['Financeiro (Visão Geral)', 'Contas a Pagar', 'A Receber', 'Inadimplência'],
  },
  {
    group: 'Comunicação',
    items: ['Mensagens', 'Chamados'],
  },
  {
    group: 'Outros',
    items: ['Acesso / Login', 'Configurações', 'Outro'],
  },
];

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  waiting_customer: 'Aguardando',
  resolved: 'Resolvido',
  reopened: 'Reaberto',
  closed: 'Fechado',
};
const STATUS_TONE: Record<string, 'warning' | 'success' | 'primary' | 'danger'> = {
  open: 'warning',
  in_progress: 'primary',
  waiting_customer: 'warning',
  resolved: 'success',
  reopened: 'warning',
  closed: 'success',
};

const MAX_IMAGES   = 5;
const MAX_SIZE_MB  = 2;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function TicketsPage() {
  const [tickets, setTickets]         = useState<Ticket[]>([]);
  const [loading, setLoading]         = useState(true);
  const [open, setOpen]               = useState(false);
  const [detail, setDetail]           = useState<TicketDetail | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState('');

  // Form state
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory]     = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachErr, setAttachErr]   = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setTickets(await listTickets()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  function resetForm() {
    setTitle(''); setDescription(''); setCategory('');
    setAttachments([]); setAttachErr(''); setFormError('');
  }

  function openModal() { resetForm(); setOpen(true); }
  function closeModal() { resetForm(); setOpen(false); }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setAttachErr('');
    const next = [...attachments];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { setAttachErr('Apenas imagens são aceitas.'); continue; }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setAttachErr(`Imagem "${file.name}" excede ${MAX_SIZE_MB} MB.`);
        continue;
      }
      if (next.length >= MAX_IMAGES) { setAttachErr(`Máximo de ${MAX_IMAGES} imagens.`); break; }
      next.push(await fileToBase64(file));
    }
    setAttachments(next);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onCreate() {
    setFormError('');
    if (!title.trim()) { setFormError('Informe o título.'); return; }
    if (!category) { setFormError('Selecione a área do erro.'); return; }
    setSubmitting(true);
    try {
      await createTicket({ title: title.trim(), description: description.trim(), category, attachments });
      await load();
      closeModal();
    } catch (e: any) {
      setFormError(e?.message ?? 'Erro ao abrir chamado.');
    } finally { setSubmitting(false); }
  }

  async function openDetail(id: string) {
    const d = await getTicket(id);
    setDetail(d);
  }

  async function onComment() {
    if (!detail || !commentText.trim()) return;
    await addComment(detail.id, commentText.trim());
    setCommentText('');
    setDetail(await getTicket(detail.id));
  }

  async function onClose() {
    if (!detail) return;
    await closeTicket(detail.id);
    setDetail(null);
    await load();
  }

  // ─── Detail view ────────────────────────────────────────────────────────────
  if (detail) {
    return (
      <>
        <button
          className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          onClick={() => { setDetail(null); load(); }}
        >
          <ChevronLeft size={16} /> Voltar
        </button>

        <div className="card p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {detail.category && (
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {detail.category}
                  </span>
                )}
                <StatusBadge tone={STATUS_TONE[detail.status] ?? 'warning'}>
                  {STATUS_LABEL[detail.status] ?? detail.status}
                </StatusBadge>
              </div>
              <h2 className="text-lg font-semibold text-ink">{detail.title}</h2>
              <p className="text-sm text-ink-muted">
                Aberto por {detail.opened_by_name} em {new Date(detail.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            {detail.status === 'open' && (
              <button className="btn-outline shrink-0 text-xs" onClick={onClose}>
                <X size={14} /> Fechar chamado
              </button>
            )}
          </div>

          <p className="mb-4 whitespace-pre-wrap text-sm text-ink-muted">{detail.description}</p>

          {/* Attachments */}
          {detail.attachments && detail.attachments.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <Paperclip size={12} className="mr-1 inline" />Anexos
              </p>
              <div className="flex flex-wrap gap-3">
                {detail.attachments.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noreferrer">
                    <img
                      src={src}
                      alt={`Anexo ${i + 1}`}
                      className="h-24 w-24 rounded-xl border border-border object-cover transition hover:opacity-80"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <h3 className="mb-3 text-sm font-semibold text-ink">Comentários</h3>
          <div className="mb-4 space-y-3">
            {detail.comments.length === 0 && (
              <p className="text-sm text-ink-muted">Nenhum comentário ainda.</p>
            )}
            {detail.comments.map(c => (
              <div key={c.id} className="rounded-xl border border-border bg-canvas p-3">
                <p className="text-sm text-ink">{c.message}</p>
                <p className="mt-1 text-xs text-ink-subtle">
                  {c.user_name} — {new Date(c.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ))}
          </div>

          {detail.status === 'open' && (
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Escreva um comentário…"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onComment()}
              />
              <button className="btn-primary" onClick={onComment}><Send size={16} /></button>
            </div>
          )}
        </div>
      </>
    );
  }

  // ─── List view ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-muted">
        <Loader2 className="animate-spin" size={24} />
        <span className="ml-2">Carregando…</span>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Chamados"
        subtitle="Abra e acompanhe solicitações de suporte."
        actions={
          <button className="btn-primary" onClick={openModal}>
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
            action={
              <button className="btn-primary" onClick={openModal}>
                <Plus size={16} /> Novo chamado
              </button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                <th className="px-4 py-3">Assunto</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Aberto por</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-canvas"
                  onClick={() => openDetail(t.id)}
                >
                  <td className="px-4 py-3 font-medium text-primary hover:underline">
                    <span className="flex items-center gap-2">
                      {t.title}
                      {t.attachments && t.attachments.length > 0 && (
                        <Paperclip size={12} className="shrink-0 text-ink-muted" />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {t.category
                      ? <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">{t.category}</span>
                      : <span className="text-ink-subtle">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{t.opened_by_name}</td>
                  <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={STATUS_TONE[t.status] ?? 'warning'}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Modal novo chamado ─────────────────────────────────────────────── */}
      <Modal
        open={open}
        title="Novo chamado"
        onClose={closeModal}
        footer={
          <>
            <button className="btn-outline" onClick={closeModal} disabled={submitting}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={onCreate} disabled={submitting}>
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Enviando…</>
                : <><Send size={14} /> Enviar chamado</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              <AlertTriangle size={15} /> {formError}
            </div>
          )}

          {/* Área do erro */}
          <div>
            <label className="label">Área do erro *</label>
            <select
              className="input"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">Selecione a área…</option>
              {TICKET_CATEGORIES.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="label">Título *</label>
            <input
              className="input"
              placeholder="Resumo curto do problema"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="label">Descrição</label>
            <textarea
              className="input min-h-[100px] resize-y"
              placeholder="Descreva o problema com o máximo de detalhes…"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Anexos */}
          <div>
            <label className="label">
              Anexos (imagens) — máx. {MAX_IMAGES} • {MAX_SIZE_MB} MB cada
            </label>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />

            {/* Preview grid */}
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((src, i) => (
                  <div key={i} className="relative">
                    <img
                      src={src}
                      alt={`Anexo ${i + 1}`}
                      className="h-20 w-20 rounded-xl border border-border object-cover"
                    />
                    <button
                      type="button"
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-danger text-white shadow"
                      onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {attachErr && (
              <p className="mb-2 flex items-center gap-1 text-xs text-warning">
                <AlertTriangle size={12} /> {attachErr}
              </p>
            )}

            {attachments.length < MAX_IMAGES && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border bg-canvas px-4 py-2.5 text-sm text-ink-muted transition hover:border-primary hover:bg-primary-soft/30 hover:text-primary"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={16} /> Adicionar imagem
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
