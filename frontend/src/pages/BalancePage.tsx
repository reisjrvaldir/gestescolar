import { useEffect, useState } from 'react';
import { PiggyBank, Wallet, TrendingUp, ArrowDownCircle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { api } from '@/lib/api';
import { brl } from '@/lib/fees';

interface BalanceSummary {
  available_balance: number;
  pending_balance: number;
  gross_received_total: number;
  platform_fees_total: number;
  provider_fees_total: number;
  withdrawn_total: number;
}

export function BalancePage() {
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ ok: boolean; data: BalanceSummary }>('/invoices/balance/summary')
      .then((r) => setBalance(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !balance) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  const totalFees = Number(balance.platform_fees_total) + Number(balance.provider_fees_total);

  return (
    <>
      <PageHeader
        title="Saldo / Resgate"
        subtitle="Acompanhe o saldo da escola e o histórico de recebimentos."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Saldo disponível" value={brl(balance.available_balance)} icon={PiggyBank} tone="success" />
        <MetricCard label="Saldo pendente" value={brl(balance.pending_balance)} icon={Wallet} tone="warning" hint="aguardando compensação" />
        <MetricCard label="Total bruto recebido" value={brl(balance.gross_received_total)} icon={TrendingUp} tone="primary" />
        <MetricCard label="Total sacado" value={brl(balance.withdrawn_total)} icon={ArrowDownCircle} tone="primary" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-base font-bold text-ink">Detalhamento</h2>
          <div className="space-y-3 text-sm">
            <Row label="Recebido bruto" value={brl(balance.gross_received_total)} />
            <Row label="Taxas da plataforma (3%)" value={`– ${brl(balance.platform_fees_total)}`} tone="text-warning" />
            <Row label="Taxas Nuvende (PIX)" value={`– ${brl(balance.provider_fees_total)}`} tone="text-warning" />
            <Row label="Total em taxas" value={`– ${brl(totalFees)}`} />
            <div className="border-t border-border pt-2">
              <Row label="Líquido recebido" value={brl(Number(balance.gross_received_total) - totalFees)} strong tone="text-success" />
            </div>
            <Row label="Já sacado" value={`– ${brl(balance.withdrawn_total)}`} />
            <div className="border-t border-border pt-2">
              <Row label="Disponível para saque" value={brl(balance.available_balance)} strong tone="text-success" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-base font-bold text-ink">Solicitar resgate</h2>
          <p className="text-sm text-ink-muted">
            O resgate de valores será habilitado quando a integração com a Nuvende estiver ativa.
            Nesse momento, você poderá solicitar transferências do saldo disponível para a conta bancária da escola.
          </p>
          <button className="btn-outline mt-4" disabled>
            <ArrowDownCircle size={16} /> Solicitar resgate (em breve)
          </button>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'font-bold' : ''}`}>
      <span className={strong ? 'text-ink' : 'text-ink-muted'}>{label}</span>
      <span className={tone ?? 'text-ink'}>{value}</span>
    </div>
  );
}
