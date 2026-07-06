import { Star } from 'lucide-react';
import { TESTIMONIALS } from '@/data/landing';

export function Testimonials() {
  return (
    <section id="depoimentos" className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-ink">O que nossos clientes dizem</h2>
        <p className="mt-3 text-ink-muted">Escolas que transformaram sua gestão com o GestEscolar.</p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div className="flex gap-0.5 text-warning">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={15} fill="currentColor" />)}
            </div>
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink">"{t.text}"</blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple text-sm font-bold text-white">
                {t.name.split(' ').slice(0, 2).map((p) => p[0]).join('')}
              </div>
              <div>
                <p className="text-sm font-bold text-ink">{t.name}</p>
                <p className="text-xs text-ink-muted">{t.role}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
