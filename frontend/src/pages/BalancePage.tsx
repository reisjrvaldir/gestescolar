import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PiggyBank, Wallet, TrendingUp, ArrowDownCircle, Loader2, Check, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';
import { payoutService, PIX_KEY_TYPE_LABELS, type WithdrawalsInfo, type Withdrawal } from '@/services/payout';

interface BalanceSummary {
  available_balance: number;
  pending_balance: number;
  gross_received_total: number;
  platform_fees_total: number;
  provider_fees_total: number;
  withdrawn_total: number;
}

const WD_STATUS: Record<Withdrawal['status'], { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  requested: { tone: 'warning', label: 'Solicitado' },
  processing: { tone: 'warning', label: 'Processando' },
  paid: { tone: 'success', label: 'Pago' },
  failed: { tone: 'danger', label: 'Falhou' },
  cancelled: { tone: 'neutral', label: 'Cancelado' },
};

export function BalancePage() {
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [wd, setWd] = useState<WithdrawalsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [b, w] = await Promise.all([
        api.get<{ ok: boolean; data: BalanceSummary }>('/invoices/balance/summary').then((r) => r.data),
        payoutService.withdrawals().catch(() => null),
      ]);
      setBalance(b);
      setWd(w);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  }

  const available = balance?.available_balance ?? 0;
  const parsedAmount = Math.round(Number(amount.replace(',', '.')) * 100) / 100;
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= available;
  const hasPix = !!wd?.pix_key;

  async function confirmWithdraw() {
    setSubmitting(true);
    try {
      const r = await payoutService.withdraw(parsedAmount);
      showToast('success', `Saque de ${brl(r.amount)} solicitado. O PIX cai na chave cadastrada em instantes.`);
      setConfirming(false);
      setAmount('');
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Não foi possível concluir o saque.');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !balance) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  const totalFees = Number(balance.platform_fees_total) + Number(balance.provider_fees_total);

  return (
    <>
      <PageHeader title="Saldo / Resgate" subtitle="Acompanhe o saldo da escola e saque para a sua conta." />

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />} {toast.msg}
        </div>
      )}

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
          <h2 className="mb-1 text-base font-bold text-ink">Sacar saldo via PIX</h2>
          {!hasPix ? (
            <>
              <p className="mt-2 text-sm text-ink-muted">
                Para sacar, primeiro cadastre a chave PIX de recebimento e conclua a abertura da subconta.
              </p>
              <Link to="/app/settings" className="btn-outline mt-4 inline-flex"><Wallet size={16} /> Configurar recebimento</Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-muted">
                O valor cai na sua chave PIX <span className="font-semibold text-ink">{wd?.pix_key}</span>
                {wd?.pix_key_type ? ` (${PIX_KEY_TYPE_LABELS[wd.pix_key_type]})` : ''}.
              </p>
              <div className="mt-4">
                <label className="label">Valor do saque</label>
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-outline whitespace-nowrap text-xs"
                    onClick={() => setAmount(String(available.toFixed(2)))}
                  >
                    Tudo
                  </button>
                </div>
                <p className="mt-1 text-xs text-ink-subtle">Disponível: {brl(available)}</p>
                {amount && !amountValid && (
                  <p className="mt-1 text-xs text-danger">
                    {parsedAmount > available ? 'Valor acima do saldo disponível.' : 'Informe um valor válido.'}
                  </p>
                )}
              </div>
              <button
                className="btn-primary mt-4 w-full justify-center"
                disabled={!amountValid}
                onClick={() => setConfirming(true)}
              >
                <ArrowDownCircle size={16} /> Sacar {amountValid ? brl(parsedAmount) : ''}
              </button>
            </>
          )}
        </div>
      </div>

      {wd && wd.history.length > 0 && (
        <div className="card mt-4 overflow-hidden">
          <div className="border-b border-border px-5 py-4 text-sm font-bold text-ink">Histórico de saques</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                  <th className="px-5 py-2.5">Data</th>
                  <th className="px-5 py-2.5 text-right">Valor</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {wd.history.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5 text-ink-muted">{fmtDate(h.requested_at)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-ink">{brl(h.amount)}</td>
                    <td className="px-5 py-2.5"><StatusBadge tone={WD_STATUS[h.status].tone}>{WD_STATUS[h.status].label}</StatusBadge></td>
                    <td className="px-5 py-2.5 text-xs text-ink-muted">{h.status === 'failed' ? (h.failed_reason ?? '—') : h.paid_at ? `Pago ${fmtDate(h.paid_at)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={confirming}
        title="Confirmar saque"
        onClose={() => !submitting && setConfirming(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setConfirming(false)} disabled={submitting}>Cancelar</button>
            <button className="btn-primary" onClick={confirmWithdraw} disabled={submitting}>
              {submitting && <Loader2 size={16} className="animate-spin" />} Confirmar saque
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-ink-muted">Você está sacando o saldo da escola para a sua chave PIX. Esta ação transfere o dinheiro e não pode ser desfeita.</p>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-ink-muted">Valor</span>
            <span className="text-lg font-extrabold text-ink">{brl(parsedAmount || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Destino</span>
            <span className="font-medium text-ink">{wd?.pix_key}</span>
          </div>
        </div>
      </Modal>
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
