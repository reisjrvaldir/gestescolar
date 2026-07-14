import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { saasService, type SaasAuditLogRow } from '@/services/saas';

type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral';

const ACTION: Record<string, { label: string; tone: Tone }> = {
  PAYMENT_CONFIRMED: { label: 'Pagamento confirmado', tone: 'success' },
  SUBSCRIPTION_PAYMENT_CONFIRMED: { label: 'Pagamento de assinatura', tone: 'success' },
  SCHOOL_SUSPENDED: { label: 'Escola suspensa', tone: 'danger' },
  SCHOOL_REACTIVATED: { label: 'Escola reativada', tone: 'success' },
  ACCESS_EXTENDED: { label: 'Acesso prorrogado', tone: 'warning' },
  WITHDRAWAL_REQUESTED: { label: 'Saque solicitado', tone: 'primary' },
};

function label(action: string): { label: string; tone: Tone } {
  return ACTION[action] ?? { label: action.replace(/_/g, ' ').toLowerCase(), tone: 'neutral' };
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SaasAuditLogsPage() {
  const [rows, setRows] = useState<SaasAuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('todas');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await saasService.auditLogs());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar os logs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))), [rows]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (action !== 'todas' && r.action !== action) return false;
      if (!q) return true;
      return [r.school_name, r.actor, r.action, r.entity_type].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [rows, query, action]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando logs…</span></div>;
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
        title="Logs de acesso"
        subtitle="Auditoria das ações críticas da plataforma (últimos 200 eventos)."
        actions={<button className="btn-outline" onClick={load} title="Atualizar"><RefreshCw size={15} /></button>}
      />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <select className="input w-52" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="todas">Todas as ações</option>
            {actions.map((a) => <option key={a} value={a}>{label(a).label}</option>)}
          </select>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input className="input w-64 pl-9" placeholder="Buscar escola, ator…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-subtle">Nenhum evento encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                  <th className="px-5 py-2.5">Data/hora</th>
                  <th className="px-5 py-2.5">Ação</th>
                  <th className="px-5 py-2.5">Ator</th>
                  <th className="hidden px-5 py-2.5 md:table-cell">Escola</th>
                  <th className="hidden px-5 py-2.5 lg:table-cell">Entidade</th>
                  <th className="hidden px-5 py-2.5 lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const a = label(r.action);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{fmtDateTime(r.created_at)}</td>
                      <td className="px-5 py-2.5"><StatusBadge tone={a.tone}>{a.label}</StatusBadge></td>
                      <td className="px-5 py-2.5 text-ink">{r.actor ?? '—'}</td>
                      <td className="hidden px-5 py-2.5 text-ink-muted md:table-cell">{r.school_name ?? '—'}</td>
                      <td className="hidden px-5 py-2.5 text-ink-muted lg:table-cell">{r.entity_type ?? '—'}</td>
                      <td className="hidden px-5 py-2.5 text-ink-subtle lg:table-cell">{r.ip_address ?? '—'}</td>
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
