import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { saasService, type SaasSubscriptionRow } from '@/services/saas';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';

type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral';
const STATUS: Record<string, { tone: Tone; label: string }> = {
  active: { tone: 'success', label: 'Ativa' },
  trialing: { tone: 'primary', label: 'Trial' },
  past_due: { tone: 'danger', label: 'Em atraso' },
  canceled: { tone: 'neutral', label: 'Cancelada' },
  cancelled: { tone: 'neutral', label: 'Cancelada' },
};

export function SaasSubscriptionsPage() {
  const [rows, setRows] = useState<SaasSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await saasService.subscriptions());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar as assinaturas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => (r.school_name ?? '').toLowerCase().includes(q) || r.plan.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando assinaturas…</span></div>;
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
        title="Planos e assinaturas"
        subtitle="Assinaturas das escolas: plano, ciclo, status e vigência."
        actions={<button className="btn-outline" onClick={load} title="Atualizar"><RefreshCw size={15} /></button>}
      />

      <div className="card overflow-hidden">
        <div className="flex items-center justify-end border-b border-border px-5 py-4">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input className="input w-64 pl-9" placeholder="Buscar escola ou plano…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-subtle">Nenhuma assinatura encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                  <th className="px-5 py-2.5">Escola</th>
                  <th className="px-5 py-2.5">Plano</th>
                  <th className="hidden px-5 py-2.5 sm:table-cell">Ciclo</th>
                  <th className="px-5 py-2.5 text-right">Valor</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="hidden px-5 py-2.5 md:table-cell">Vigência</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const st = STATUS[r.status] ?? { tone: 'neutral' as Tone, label: r.status };
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="px-5 py-2.5 font-medium text-ink">{r.school_name ?? '—'}</td>
                      <td className="px-5 py-2.5 text-ink-muted">{r.plan}</td>
                      <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{r.billing_cycle === 'annual' ? 'Anual' : r.billing_cycle === 'monthly' ? 'Mensal' : (r.billing_cycle ?? '—')}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-ink">{brl(r.amount)}</td>
                      <td className="px-5 py-2.5"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                      <td className="hidden px-5 py-2.5 text-ink-muted md:table-cell">
                        {r.current_period_end ? `até ${fmtDate(r.current_period_end)}` : '—'}
                      </td>
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
