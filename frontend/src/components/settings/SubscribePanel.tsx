import { useEffect, useState } from 'react';
import { CreditCard, Loader2, AlertTriangle } from 'lucide-react';
import { plansService, type SaasPlan } from '@/services/plans';
import { billingService } from '@/services/billing';
import { brl } from '@/lib/fees';

const INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Escolha de plano SaaS + assinatura com cartão (mensal recorrente ou
 *  anual à vista/parcelado em até 12x). Redireciona ao checkout hospedado
 *  do gateway — o cartão nunca é processado pelo nosso backend. */
export function SubscribePanel() {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState('');
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [installments, setInstallments] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    plansService.list()
      .then((data) => {
        const paid = data.filter((p) => p.monthly_price > 0);
        setPlans(paid);
        if (paid[0]) setPlanId(paid[0].id);
      })
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedPlan = plans.find((p) => p.id === planId);

  async function handleSubscribe() {
    if (!planId) return;
    setError(null);
    setSubmitting(true);
    try {
      const { checkoutUrl } = await billingService.subscribe({
        plan_id: planId,
        cycle,
        installments: cycle === 'annual' ? installments : undefined,
      });
      window.location.href = checkoutUrl;
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível iniciar a assinatura.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-6 text-ink-muted"><Loader2 className="animate-spin" size={18} /></div>;
  }
  if (plans.length === 0) {
    return <p className="text-xs text-ink-muted">Nenhum plano pago disponível no momento.</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      <div>
        <label className="label">Plano</label>
        <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {brl(p.monthly_price)}/mês ou {brl(p.annual_price)}/ano
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Forma de cobrança</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${cycle === 'monthly' ? 'border-primary bg-primary-soft text-primary' : 'border-border text-ink-muted'}`}
            onClick={() => setCycle('monthly')}
          >
            Mensal (recorrente)
          </button>
          <button
            type="button"
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${cycle === 'annual' ? 'border-primary bg-primary-soft text-primary' : 'border-border text-ink-muted'}`}
            onClick={() => setCycle('annual')}
          >
            Anual (à vista/parcelado)
          </button>
        </div>
      </div>

      {cycle === 'annual' && (
        <div>
          <label className="label">Parcelas no cartão</label>
          <select className="input" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
            {INSTALLMENT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'À vista' : `${n}x de ${selectedPlan ? brl(selectedPlan.annual_price / n) : ''}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <button className="btn-primary w-full justify-center" onClick={handleSubscribe} disabled={submitting || !planId}>
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />} Assinar com cartão
      </button>
      <p className="text-[11px] text-ink-subtle">
        Você será redirecionado a uma página segura do gateway de pagamento para inserir o cartão.
      </p>
    </div>
  );
}
