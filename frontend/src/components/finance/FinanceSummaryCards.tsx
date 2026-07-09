import { TrendingUp, TrendingDown, Wallet, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { brl } from '@/lib/fees';
import type { FinanceSummary } from '@/services/finance';

interface Props {
  summary: FinanceSummary;
}

/** 4 cards principais de resumo da Visão geral, com dados reais do mês. */
export function FinanceSummaryCards({ summary }: Props) {
  const delta = summary.forecast_delta_pct;
  const deltaPositive = delta == null || delta >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-ink-muted">Previsão de receita do mês</p>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-soft text-success">
            <TrendingUp size={18} />
          </div>
        </div>
        <p className="mt-2 text-2xl font-extrabold text-ink">{brl(summary.forecast_month)}</p>
        {delta != null ? (
          <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${deltaPositive ? 'text-success' : 'text-danger'}`}>
            {deltaPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(delta).toFixed(1)}% vs mês anterior
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-subtle">Soma das mensalidades e cobranças previstas para o mês.</p>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-ink-muted">Despesas do mês</p>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <TrendingDown size={18} />
          </div>
        </div>
        <p className="mt-2 text-2xl font-extrabold text-ink">{brl(summary.expenses_month)}</p>
        <p className="mt-1 text-xs text-ink-subtle">Contas a pagar com vencimento neste mês.</p>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-ink-muted">Saldo do mês</p>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Wallet size={18} />
          </div>
        </div>
        <p className={`mt-2 text-2xl font-extrabold ${summary.balance_month >= 0 ? 'text-ink' : 'text-danger'}`}>{brl(summary.balance_month)}</p>
        <p className="mt-1 text-xs text-ink-subtle">
          Recebido <span className="font-semibold text-success">{brl(summary.received_month)}</span> − pago <span className="font-semibold text-danger">{brl(summary.expenses_paid_month)}</span> · tempo real.
        </p>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-ink-muted">Inadimplência</p>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-soft text-purple">
            <AlertTriangle size={18} />
          </div>
        </div>
        <p className="mt-2 text-2xl font-extrabold text-ink">{brl(summary.delinquency_amount)}</p>
        <p className="mt-1 text-xs text-ink-subtle">{summary.delinquency_count} fatura(s) vencida(s).</p>
      </div>
    </div>
  );
}
