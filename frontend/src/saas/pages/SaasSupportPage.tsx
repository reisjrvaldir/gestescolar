import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search, LifeBuoy } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { saasService, type SaasTicketRow } from '@/services/saas';
import { fmtDate } from '@/lib/dates';

type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral';
const STATUS: Record<string, { tone: Tone; label: string }> = {
  open: { tone: 'primary', label: 'Aberto' },
  in_progress: { tone: 'warning', label: 'Em andamento' },
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

export function SaasSupportPage() {
  const [rows, setRows] = useState<SaasTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('todos');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'todos' && r.status !== status) return false;
      if (!q) return true;
      return [r.title, r.school_name, r.opened_by_name].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [rows, query, status]);

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
        subtitle="Tickets de suporte abertos pelas escolas."
        actions={<button className="btn-outline" onClick={load} title="Atualizar"><RefreshCw size={15} /></button>}
      />

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
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="px-5 py-2.5 font-medium text-ink">{r.title}</td>
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
    </>
  );
}
