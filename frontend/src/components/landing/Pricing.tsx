import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { plansService, type SaasPlan } from '@/services/plans';
import { brl } from '@/lib/fees';

export function Pricing() {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    plansService.list().then(setPlans).catch(() => setPlans([])).finally(() => setLoading(false));
  }, []);

  // Plano "mais escolhido" = o intermediário entre os pagos (heurística simples por preço).
  const paidSorted = [...plans].filter((p) => p.monthly_price > 0).sort((a, b) => a.monthly_price - b.monthly_price);
  const highlightId = paidSorted[Math.floor((paidSorted.length - 1) / 2)]?.id;

  return (
    <section id="planos" className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">Planos que cabem na sua escola</h2>
          <p className="mt-3 text-ink-muted">Escolha o plano ideal e comece hoje mesmo.</p>
        </div>

        {loading ? (
          <div className="mt-12 flex justify-center text-ink-muted"><Loader2 className="animate-spin" size={24} /></div>
        ) : plans.length === 0 ? (
          <p className="mt-12 text-center text-sm text-ink-muted">Planos em breve. Fale com a gente para saber mais.</p>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-4">
            {plans.map((p) => {
              const highlight = p.id === highlightId;
              const isFree = p.monthly_price <= 0;
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl border bg-surface p-7 shadow-card ${
                    highlight ? 'border-primary ring-2 ring-primary/30 lg:-mt-3 lg:mb-3' : 'border-border'
                  }`}
                >
                  {highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-purple px-3 py-1 text-xs font-bold text-white">
                      Mais escolhido
                    </span>
                  )}
                  <h3 className="text-lg font-extrabold text-ink">{p.name}</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    {p.student_limit ? `Até ${p.student_limit} alunos` : 'Alunos ilimitados'}
                  </p>
                  <p className="mt-4 text-3xl font-extrabold text-ink">
                    {isFree ? 'Grátis' : brl(p.monthly_price)}
                    {!isFree && <span className="text-sm font-normal text-ink-muted">/mês</span>}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {(p.features_json ?? []).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-ink">
                        <Check size={16} className="mt-0.5 shrink-0 text-cta" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={`/login?plan=${p.id}`}
                    className={`mt-6 w-full rounded-xl py-2.5 text-center text-sm font-bold transition ${
                      highlight ? 'bg-cta text-white hover:bg-cta-hover' : 'border border-border text-ink hover:bg-canvas'
                    }`}
                  >
                    {isFree ? 'Começar grátis' : 'Testar grátis'}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-ink-subtle">
          Pagamento via PIX e cartão de crédito. Taxa de serviço transparente: 5% por cobrança confirmada.
        </p>
      </div>
    </section>
  );
}
