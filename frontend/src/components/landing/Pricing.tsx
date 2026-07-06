import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { PLANS } from '@/data/landing';

export function Pricing() {
  return (
    <section id="planos" className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">Planos que cabem na sua escola</h2>
          <p className="mt-3 text-ink-muted">Escolha o plano ideal e comece hoje mesmo.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-2xl border bg-surface p-7 shadow-card ${
                p.highlight ? 'border-primary ring-2 ring-primary/30 lg:-mt-3 lg:mb-3' : 'border-border'
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-purple px-3 py-1 text-xs font-bold text-white">
                  Mais escolhido
                </span>
              )}
              <h3 className="text-lg font-extrabold text-ink">{p.name}</h3>
              <p className="mt-1 text-sm text-ink-muted">{p.tagline}</p>
              <p className="mt-4 text-3xl font-extrabold text-ink">
                {p.price}<span className="text-sm font-normal text-ink-muted">/mês</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink">
                    <Check size={16} className="mt-0.5 shrink-0 text-cta" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className={`mt-6 w-full rounded-xl py-2.5 text-center text-sm font-bold transition ${
                  p.highlight ? 'bg-cta text-white hover:bg-cta-hover' : 'border border-border text-ink hover:bg-canvas'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-ink-subtle">
          Pagamento via PIX e cartão. Taxa de serviço transparente: R$ 1,99 + 3% por PIX confirmado.
        </p>
      </div>
    </section>
  );
}
