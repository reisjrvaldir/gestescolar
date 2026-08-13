import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, RefreshCw, Search, LifeBuoy, Inbox, PlayCircle, CheckCircle2,
  Send, ChevronLeft, Paperclip, Clock, User as UserIcon, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { saasService, type SaasTicketRow, type SaasTicketDetail } from '@/services/saas';
import { fmtDate } from '@/lib/dates';

type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral';

const STATUS: Record<string, { tone: Tone; label: string }> = {
  open: { tone: 'primary', label: 'Aberto' },
  in_progress: { tone: 'warning', label: 'Em atendimento' },
  waiting_customer: { tone: 'warning', label: 'Aguardando cliente' },
  resolved: { tone: 'success', label: 'Resolvido' },
  reopened: { tone: 'danger', label: 'Reaberto' },
  closed: { tone: 'neutral', label: 'Fechado' },
};
const PRIORITY: Record<string, { tone: Tone; label: string }> = {
  low: { tone: 'neutral', label: 'Baixa' },
  normal: { tone: 'primary', label: 'Normal' },
  high: { tone: 'warning', label: 'Alta' },
  urgent: { tone: 'danger', label: 'Urgente' },
};

function KpiCard({ icon: Icon, tone, label, value, hint }: {
  icon: typeof Inbox; tone: 'primary' | 'warning' | 'success' | 'neutral';
  label: string; value: string; hint?: string;
}) {
  const bg: Record<string, string> = {
    primary: 'border-primary/20 bg-primary-soft/30',
    warning: 'border-warning/20 bg-warning-soft/30',
    success: 'border-success/20 bg-success-soft/30',
    neutral: 'border-border bg-canvas',
  };
  const ico: Record<string, string> = {
    primary: 'bg-primary-soft text-primary',
    warning: 'bg-warning-soft text-warning',
    success: 'bg-success-soft text-success',
    neutral: 'bg-canvas text-ink-muted',
  };
  const txt: Record<string, string> = {
    primary: 'text-primary', warning: 'text-warning',
    success: 'text-success', neutral: 'text-ink',
  };
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${bg[tone]}`}>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ico[tone]}`}>
        <Icon size={19} />
      </div>
      <div>
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className={`text-2xl font-extrabold ${txt[tone]}`}>{value}</p>
        {hint && <p className="text-[11px] text-ink-subtle">{hint}</p>}
      </div>
    </div>
  );
}

export function SaasSupportPage() {
  const [rows, setRows] = useState<SaasTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('todos');

  const [detail, setDetail] = useState<SaasTicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await saasService.tickets());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar os tickets.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function openDetail(id: string) {
    setActionError(null);
    setDetailLoading(true);
    try {
      const d = await saasService.ticket(id);
      setDetail(d);
    } catch (e: any) {
      setActionError(e?.message ?? 'Não foi possível carregar o chamado.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeStatus(next: 'in_progress' | 'resolved' | 'open' | 'closed') {
    if (!detail) return;
    setSavingStatus(next);
    setActionError(null);
    try {
      await saasService.setTicketStatus(detail.id, next);
      setDetail({ ...detail, status: next });
      setRows((prev) => prev.map((r) => (r.id === detail.id ? { ...r, status: next } : r)));
    } catch (e: any) {
      setActionError(e?.message ?? 'Não foi possível alterar o status.');
    } finally {
      setSavingStatus(null);
    }
  }

  async function sendReply() {
    if (!detail || !reply.trim()) return;
    setReplying(true);
    setActionError(null);
    try {
      await saasService.replyTicket(detail.id, reply.trim());
      setReply('');
      const fresh = await saasService.ticket(detail.id);
      setDetail(fresh);
      // Reply em ticket 'open' promove para 'in_progress' — reflete na lista.
      setRows((prev) => prev.map((r) => (r.id === detail.id ? { ...r, status: fresh.status } : r)));
    } catch (e: any) {
      setActionError(e?.message ?? 'Não foi possível enviar a resposta.');
    } finally {
      setReplying(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'todos' && r.status !== status) return false;
      if (!q) return true;
      return [r.title, r.school_name, r.opened_by_name].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [rows, query, status]);

  // KPIs — em atendimento = in_progress + waiting_customer + reopened.
  const kpis = useMemo(() => {
    const total = rows.length;
    const openCount = rows.filter((r) => r.status === 'open').length;
    const inProgress = rows.filter((r) => ['in_progress', 'waiting_customer', 'reopened'].includes(r.status)).length;
    const resolved = rows.filter((r) => r.status === 'resolved' || r.status === 'closed').length;
    return { total, openCount, inProgress, resolved };
  }, [rows]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando tickets…</span></div>;
  }
  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-danger">{error}</p>
        <button className="btn-outline mt-4" onClick={load}><RefreshCw size={15} /> Tentar novamente</button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Suporte ao cliente"
        subtitle="Gestão dos chamados abertos pelas escolas."
        actions={<button className="btn-outline" onClick={load} title="Atualizar"><RefreshCw size={15} /></button>}
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Inbox} tone="primary" label="Total de chamados" value={String(kpis.total)} hint="todos os status" />
        <KpiCard icon={AlertTriangle} tone="primary" label="Abertos" value={String(kpis.openCount)} hint="aguardando triagem" />
        <KpiCard icon={PlayCircle} tone="warning" label="Em atendimento" value={String(kpis.inProgress)} hint="sendo tratados" />
        <KpiCard icon={CheckCircle2} tone="success" label="Resolvidos" value={String(kpis.resolved)} hint="+ fechados" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input className="input w-64 pl-9" placeholder="Buscar título, escola…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><LifeBuoy size={24} /></div>
            <p className="text-sm font-medium text-ink">Nenhum ticket</p>
            <p className="text-xs text-ink-subtle">Não há tickets de suporte no momento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                  <th className="px-5 py-2.5">Título</th>
                  <th className="hidden px-5 py-2.5 md:table-cell">Escola</th>
                  <th className="hidden px-5 py-2.5 lg:table-cell">Aberto por</th>
                  <th className="px-5 py-2.5">Prioridade</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="hidden px-5 py-2.5 sm:table-cell">Aberto em</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const st = STATUS[r.status] ?? { tone: 'neutral' as Tone, label: r.status };
                  const pr = PRIORITY[r.priority] ?? { tone: 'neutral' as Tone, label: r.priority };
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-canvas"
                      onClick={() => openDetail(r.id)}
                    >
                      <td className="px-5 py-2.5 font-medium text-primary hover:underline">{r.title}</td>
                      <td className="hidden px-5 py-2.5 text-ink-muted md:table-cell">{r.school_name ?? '—'}</td>
                      <td className="hidden px-5 py-2.5 text-ink-muted lg:table-cell">{r.opened_by_name ?? '—'}</td>
                      <td className="px-5 py-2.5"><StatusBadge tone={pr.tone}>{pr.label}</StatusBadge></td>
                      <td className="px-5 py-2.5"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                      <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{fmtDate(r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de detalhes do ticket com histórico e ações */}
      <Modal
        open={detailLoading || !!detail}
        title={detail ? `Chamado — ${detail.title}` : 'Carregando…'}
        onClose={() => { setDetail(null); setReply(''); setActionError(null); }}
      >
        {detailLoading ? (
          <div className="flex justify-center py-10 text-ink-muted"><Loader2 size={20} className="animate-spin" /></div>
        ) : detail ? (
          <div className="space-y-4">
            {/* Cabeçalho */}
            <div className="rounded-xl border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {detail.category && (
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">{detail.category}</span>
                )}
                <StatusBadge tone={PRIORITY[detail.priority]?.tone ?? 'neutral'}>{PRIORITY[detail.priority]?.label ?? detail.priority}</StatusBadge>
                <StatusBadge tone={STATUS[detail.status]?.tone ?? 'neutral'}>{STATUS[detail.status]?.label ?? detail.status}</StatusBadge>
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs text-ink-muted sm:grid-cols-2">
                <p><UserIcon size={12} className="mr-1 inline" /> {detail.opened_by_name ?? '—'} · {detail.school_name ?? '—'}</p>
                <p className="sm:text-right"><Clock size={12} className="mr-1 inline" /> Aberto em {fmtDate(detail.created_at)}</p>
              </div>
              {detail.description && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{detail.description}</p>
              )}
              {detail.attachments && detail.attachments.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                    <Paperclip size={11} className="mr-1 inline" /> Anexos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detail.attachments.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noreferrer">
                        <img src={src} alt={`Anexo ${i + 1}`} className="h-20 w-20 rounded-lg border border-border object-cover hover:opacity-80" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ações de status */}
            <div className="flex flex-wrap gap-2">
              {detail.status !== 'in_progress' && detail.status !== 'resolved' && detail.status !== 'closed' && (
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning hover:bg-warning hover:text-white disabled:opacity-50"
                  onClick={() => changeStatus('in_progress')}
                  disabled={savingStatus === 'in_progress'}
                >
                  {savingStatus === 'in_progress' ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                  Marcar em atendimento
                </button>
              )}
              {detail.status !== 'resolved' && detail.status !== 'closed' && (
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-semibold text-success hover:bg-success hover:text-white disabled:opacity-50"
                  onClick={() => changeStatus('resolved')}
                  disabled={savingStatus === 'resolved'}
                >
                  {savingStatus === 'resolved' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Marcar como resolvido
                </button>
              )}
              {(detail.status === 'resolved' || detail.status === 'closed') && (
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white disabled:opacity-50"
                  onClick={() => changeStatus('open')}
                  disabled={savingStatus === 'open'}
                >
                  {savingStatus === 'open' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Reabrir chamado
                </button>
              )}
            </div>

            {actionError && (
              <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
                <AlertTriangle size={13} /> {actionError}
              </div>
            )}

            {/* Histórico */}
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Histórico</p>
              <div className="space-y-2">
                {detail.comments.length === 0 && (
                  <p className="text-xs text-ink-subtle">Nenhuma resposta ainda.</p>
                )}
                {detail.comments.map((c) => {
                  const isSupport = c.user_role === 'superadmin';
                  return (
                    <div
                      key={c.id}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        isSupport
                          ? 'border-primary/30 bg-primary-soft/30'
                          : 'border-border bg-canvas'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-ink">{c.message}</p>
                      <p className="mt-1 text-[11px] text-ink-subtle">
                        {isSupport ? 'Suporte GestEscolar' : (c.user_name ?? 'Escola')} — {new Date(c.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Nova resposta */}
            {detail.status !== 'closed' && (
              <div>
                <p className="mb-2 text-sm font-bold text-ink">Responder à escola</p>
                <textarea
                  className="input min-h-[80px] resize-y"
                  placeholder="Escreva sua resposta como suporte GestEscolar…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button
                  className="btn-primary mt-2"
                  onClick={sendReply}
                  disabled={replying || !reply.trim()}
                >
                  {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar resposta
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                className="btn-outline"
                onClick={() => { setDetail(null); setReply(''); setActionError(null); }}
              >
                <ChevronLeft size={14} /> Fechar
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
