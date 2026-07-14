import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search, DollarSign, CheckCircle, Hash } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { saasService, type SaasTransactions } from '@/services/saas';
import { brl } from '@/lib/fees';

type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral';
const STATUS: Record<string, { tone: Tone; label: string }> = {
  confirmed: { tone: 'success', label: 'Confirmado' },
  pending: { tone: 'warning', label: 'Pendente' },
  failed: { tone: 'danger', label: 'Falhou' },
  refunded: { tone: 'neutral', label: 'Estornado' },
};

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function SaasTransactionsPage() {
  const [data, setData] = useState<SaasTransactions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'todas' | 'assinatura' | 'mensalidade'>('todas');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await saasService.transactions());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar as transações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (kind !== 'todas' && r.kind !== kind) return false;
      if (!q) return true;
      return (r.school_name ?? '').toLowerCase().includes(q);
    });
  }, [data, query, kind]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando transações…</span></div>;
  }
  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-danger">{error ?? 'Sem dados.'}</p>
        <button className="btn-outline mt-4" onClick={load}><RefreshCw size={15} /> Tentar novamente</button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Cobranças e transações"
        subtitle="Todos os pagamentos processados na plataforma."
        actions={<button className="btn-outline" onClick={load} title="Atualizar"><RefreshCw size={15} /></button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard icon={<DollarSign size={18} />} label="Total confirmado" value={brl(data.totals.confirmed_total)} />
        <MetricCard icon={<CheckCircle size={18} />} label="Pagamentos confirmados" value={String(data.totals.confirmed_count)} />
        <MetricCard icon={<Hash size={18} />} label="Total de transações" value={String(data.totals.total_count)} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <select className="input w-48" value={kind} onChange={(e) => setKind(e.target.value as any)}>
            <option value="todas">Todos os tipos</option>
            <option value="assinatura">Assinatura (SaaS)</option>
            <option value="mensalidade">Mensalidade (aluno)</option>
          </select>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input className="input w-64 pl-9" placeholder="Buscar escola…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-subtle">Nenhuma transação encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                  <th className="px-5 py-2.5">Data</th>
                  <th className="px-5 py-2.5">Escola</th>
                  <th className="px-5 py-2.5">Tipo</th>
                  <th className="hidden px-5 py-2.5 sm:table-cell">Método</th>
                  <th className="px-5 py-2.5 text-right">Valor</th>
                  <th className="px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const st = STATUS[r.status] ?? { tone: 'neutral' as Tone, label: r.status };
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{fmtDateTime(r.paid_at ?? r.created_at)}</td>
                      <td className="px-5 py-2.5 font-medium text-ink">{r.school_name ?? '—'}</td>
                      <td className="px-5 py-2.5 text-ink-muted">{r.kind === 'assinatura' ? 'Assinatura' : 'Mensalidade'}</td>
                      <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{r.payment_method === 'card' ? 'Cartão' : r.payment_method === 'pix' ? 'PIX' : (r.payment_method ?? '—')}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-ink">{brl(r.amount)}</td>
                      <td className="px-5 py-2.5"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
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
