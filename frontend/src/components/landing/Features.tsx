import { FEATURES } from '@/data/landing';

export function Features() {
  return (
    <section id="funcionalidades" className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-ink">Tudo que sua escola precisa em um só lugar</h2>
        <p className="mt-3 text-ink-muted">
          Módulos integrados para simplificar a rotina da secretaria, financeiro, coordenação e professores.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-border bg-surface p-6 shadow-card transition hover:-translate-y-1 hover:shadow-card-hover"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-white">
              <f.icon size={22} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
