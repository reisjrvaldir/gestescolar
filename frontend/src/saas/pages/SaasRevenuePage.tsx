import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, DollarSign, Repeat, Ticket } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { RevenueChart } from '../components/RevenueChart';
import { DonutChart } from '../components/DonutChart';
import { saasService, toPlanSlices, type SaasRevenue } from '@/services/saas';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';

function MetricCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

/** Receitas do SaaS: MRR, ARR, ticket médio, evolução e receita por plano. */
export function SaasRevenuePage() {
  const [data, setData] = useState<SaasRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await saasService.revenue());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar as receitas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando receitas…</span></div>;
  }
  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-danger">{error ?? 'Sem dados.'}</p>
        <button className="btn-outline mt-4" onClick={load}><RefreshCw size={15} /> Tentar novamente</button>
      </div>
    );
  }

  const delta = data.revenue_delta_pct;
  const deltaUp = delta == null || delta >= 0;

  return (
    <>
      <PageHeader
        title="Receitas do SaaS"
        subtitle="MRR, ARR, ticket médio e evolução da receita de assinaturas."
        actions={<button className="btn-outline" onClick={load} title="Atualizar"><RefreshCw size={15} /></button>}
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<Repeat size={18} />} label="MRR (receita recorrente)" value={brl(data.mrr)}
            hint={`${data.active_count} escola(s) ativa(s)`} />
          <MetricCard icon={<TrendingUp size={18} />} label="ARR (projeção anual)" value={brl(data.arr)}
            hint="MRR × 12" />
          <MetricCard icon={<DollarSign size={18} />} label="Recebido no mês" value={brl(data.revenue_month)}
            hint={delta != null ? (
              <span className={`inline-flex items-center gap-1 font-medium ${deltaUp ? 'text-success' : 'text-danger'}`}>
                {deltaUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(delta).toFixed(1)}% vs mês anterior
              </span>
            ) : 'Pagamentos de assinatura confirmados'} />
          <MetricCard icon={<Ticket size={18} />} label="Ticket médio" value={brl(data.avg_ticket)}
            hint="MRR ÷ escolas ativas" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2"><RevenueChart data={data.series} /></div>
          <DonutChart title="Receita por plano" slices={toPlanSlices(data.by_plan)} />
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-border px-5 py-4 text-sm font-bold text-ink">Últimos pagamentos de assinatura</div>
          {data.recent.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhum pagamento de assinatura ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                    <th className="px-5 py-2.5">Escola</th>
                    <th className="px-5 py-2.5">Data</th>
                    <th className="px-5 py-2.5 text-right">Valor</th>
                    <th className="px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="px-5 py-2.5 font-medium text-ink">{r.school_name}</td>
                      <td className="px-5 py-2.5 text-ink-muted">{r.paid_at ? fmtDate(r.paid_at) : '—'}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-ink">{brl(r.amount)}</td>
                      <td className="px-5 py-2.5 text-ink-muted">{r.status === 'confirmed' ? 'Confirmado' : r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
