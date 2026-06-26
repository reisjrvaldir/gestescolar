import { MODULES } from '@/data/landing';

// Mini-mockups em HTML/CSS, um por módulo.
function Mockup({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {['342', 'R$ 48k', '18'].map((v, i) => (
          <div key={i} className="rounded-lg bg-canvas p-2 text-center">
            <p className="text-xs font-extrabold text-ink">{v}</p>
          </div>
        ))}
        <div className="col-span-3 mt-1 flex h-12 items-end gap-1 rounded-lg bg-canvas p-2">
          {[40, 70, 55, 85, 65].map((h, i) => <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />)}
        </div>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="space-y-1.5">
        {[['Receitas', '+ R$ 48.200', 'text-cta'], ['Despesas', '- R$ 12.400', 'text-danger'], ['Saldo', 'R$ 35.800', 'text-ink']].map(([l, v, c]) => (
          <div key={l} className="flex items-center justify-between rounded-lg bg-canvas px-2.5 py-1.5">
            <span className="text-[11px] text-ink-muted">{l}</span>
            <span className={`text-[11px] font-bold ${c}`}>{v}</span>
          </div>
        ))}
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="space-y-1.5">
        {['Ana Júlia', 'Pedro Henrique', 'Maria Eduarda'].map((n, i) => (
          <div key={n} className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-[9px] font-bold text-primary">
              {n.split(' ').map((p) => p[0]).join('')}
            </div>
            <span className="flex-1 text-[11px] text-ink">{n}</span>
            <span className="text-[10px] text-ink-subtle">{['9º A', '7º B', '5º A'][i]}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {['Contrato de matrícula', 'Autorização de saída', 'Histórico escolar'].map((d) => (
        <div key={d} className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-1.5">
          <div className="h-5 w-4 rounded-sm bg-purple/20" />
          <span className="flex-1 text-[11px] text-ink">{d}</span>
          <span className="text-[10px] font-semibold text-cta">PDF</span>
        </div>
      ))}
    </div>
  );
}

export function ModulesShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-ink">Módulos pensados para o dia a dia</h2>
        <p className="mt-3 text-ink-muted">Telas reais do sistema para cada área da sua escola.</p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {MODULES.map((m, i) => (
          <div key={m.title} className="rounded-2xl border border-border bg-surface p-6 shadow-card transition hover:shadow-card-hover">
            <div className="rounded-xl border border-border bg-surface p-3">
              <Mockup index={i} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink">{m.title}</h3>
            <p className="mt-2 text-sm text-ink-muted">{m.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
