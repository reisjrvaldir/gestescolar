import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search, Wallet, Clock, Landmark, Percent } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { saasService, type SaasPayouts } from '@/services/saas';
import { brl } from '@/lib/fees';

function MetricCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
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

/** Repasses para escolas: saldos disponíveis, pendentes, bruto recebido e taxas. */
export function SaasPayoutsPage() {
  const [data, setData] = useState<SaasPayouts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await saasService.payouts());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar os repasses.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return q ? data.schools.filter((s) => s.name.toLowerCase().includes(q)) : data.schools;
  }, [data, query]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando repasses…</span></div>;
  }
  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-danger">{error ?? 'Sem dados.'}</p>
        <button className="btn-outline mt-4" onClick={load}><RefreshCw size={15} /> Tentar novamente</button>
      </div>
    );
  }

  const t = data.totals;

  return (
    <>
      <PageHeader
        title="Repasses para escolas"
        subtitle="Saldos do split ASAAS: disponível, a liberar, bruto recebido e taxas da plataforma."
        actions={<button className="btn-outline" onClick={load} title="Atualizar"><RefreshCw size={15} /></button>}
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<Wallet size={18} />} label="Disponível para saque" value={brl(t.available)} hint="Somado de todas as escolas" />
          <MetricCard icon={<Clock size={18} />} label="A liberar" value={brl(t.pending)} hint="Ainda em compensação" />
          <MetricCard icon={<Landmark size={18} />} label="Bruto recebido" value={brl(t.gross)} hint="Total processado no split" />
          <MetricCard icon={<Percent size={18} />} label="Taxas da plataforma" value={brl(t.platform_fees)} hint="Receita retida do split" />
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <span className="text-sm font-bold text-ink">Saldos por escola</span>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                className="input w-64 pl-9"
                placeholder="Buscar escola…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhuma escola encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                    <th className="px-5 py-2.5">Escola</th>
                    <th className="px-5 py-2.5 text-right">Disponível</th>
                    <th className="hidden px-5 py-2.5 text-right sm:table-cell">A liberar</th>
                    <th className="hidden px-5 py-2.5 text-right lg:table-cell">Bruto recebido</th>
                    <th className="hidden px-5 py-2.5 text-right lg:table-cell">Taxas</th>
                    <th className="px-5 py-2.5 text-right">Já sacado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="px-5 py-2.5 font-medium text-ink">{s.name}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-ink">{brl(s.available_balance)}</td>
                      <td className="hidden px-5 py-2.5 text-right text-ink-muted sm:table-cell">{brl(s.pending_balance)}</td>
                      <td className="hidden px-5 py-2.5 text-right text-ink-muted lg:table-cell">{brl(s.gross_received_total)}</td>
                      <td className="hidden px-5 py-2.5 text-right text-ink-muted lg:table-cell">{brl(s.platform_fees_total)}</td>
                      <td className="px-5 py-2.5 text-right text-ink-muted">{brl(s.withdrawn_total)}</td>
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
