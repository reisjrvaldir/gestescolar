import { STEPS } from '@/data/landing';

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">Como funciona</h2>
          <p className="mt-3 text-ink-muted">Em poucos passos, sua escola mais organizada e eficiente.</p>
        </div>

        <div className="relative mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* linha conectora (desktop) */}
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-primary/30 via-purple/30 to-cta/30 lg:block" />
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-border bg-surface p-6 text-center shadow-card">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple text-lg font-extrabold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 font-bold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
