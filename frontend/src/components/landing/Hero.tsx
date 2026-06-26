import { Link } from 'react-router-dom';
import {
  Play, Check, LayoutDashboard, GraduationCap, Wallet,
  School2, CalendarDays,
} from 'lucide-react';

export function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden">
      {/* brilho de fundo */}
      <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-purple/20 blur-3xl" />
      <div className="pointer-events-none absolute -top-20 left-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
        {/* Esquerda */}
        <div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
            A gestão escolar completa em uma plataforma{' '}
            <span className="bg-gradient-to-r from-primary to-purple bg-clip-text text-transparent">simples</span>,{' '}
            <span className="bg-gradient-to-r from-primary to-purple bg-clip-text text-transparent">moderna</span> e{' '}
            <span className="bg-gradient-to-r from-primary to-purple bg-clip-text text-transparent">inteligente</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            Centralize matrículas, financeiro, comunicação, alunos, professores e cobranças via PIX em um só lugar.
            Mais organização, menos burocracia e mais tempo para o que realmente importa: a educação.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-cta px-6 py-3 text-sm font-bold text-white shadow-card transition hover:bg-cta-hover">
              Começar teste grátis
            </Link>
            <a href="#como-funciona" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-3 text-sm font-bold text-ink transition hover:bg-canvas">
              <Play size={16} /> Ver demonstração
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
            {['Teste grátis por 7 dias', 'Sem cartão de crédito', 'Suporte humanizado'].map((b) => (
              <li key={b} className="flex items-center gap-1.5">
                <Check size={16} className="text-cta" /> {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Direita — mockup */}
        <div className="relative">
          <div className="rounded-2xl border border-border bg-surface p-3 shadow-card-hover">
            {/* barra do "navegador" */}
            <div className="mb-3 flex items-center gap-1.5 px-1">
              <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-cta/60" />
            </div>
            <div className="flex gap-3">
              {/* sidebar */}
              <div className="hidden w-28 shrink-0 rounded-xl bg-canvas p-2 sm:block">
                {[LayoutDashboard, GraduationCap, Wallet, School2, CalendarDays].map((Icon, i) => (
                  <div key={i} className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${i === 0 ? 'bg-primary-soft text-primary' : 'text-ink-subtle'}`}>
                    <Icon size={13} /> {['Painel', 'Alunos', 'Financeiro', 'Turmas', 'Agenda'][i]}
                  </div>
                ))}
              </div>
              {/* conteúdo */}
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l: 'Alunos ativos', v: '342', t: 'text-primary' },
                    { l: 'Receita do mês', v: 'R$ 48.200', t: 'text-cta' },
                    { l: 'Inadimplência', v: 'R$ 3.150', t: 'text-danger' },
                    { l: 'Turmas', v: '18', t: 'text-purple' },
                  ].map((c) => (
                    <div key={c.l} className="rounded-xl border border-border p-2.5">
                      <p className="text-[10px] text-ink-muted">{c.l}</p>
                      <p className={`text-base font-extrabold ${c.t}`}>{c.v}</p>
                    </div>
                  ))}
                </div>
                {/* gráfico */}
                <div className="mt-2 flex h-20 items-end gap-1.5 rounded-xl border border-border p-2">
                  {[45, 65, 50, 80, 60, 90, 75].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary to-purple" style={{ height: `${h}%` }} />
                  ))}
                </div>
                {/* próximas cobranças */}
                <div className="mt-2 rounded-xl border border-border p-2.5">
                  <p className="mb-1.5 text-[11px] font-bold text-ink">Próximas cobranças</p>
                  {[['Ana Júlia', 'Pago'], ['Pedro H.', 'Pendente'], ['Maria E.', 'Pago']].map(([n, s]) => (
                    <div key={n} className="flex items-center justify-between py-0.5 text-[10px]">
                      <span className="text-ink-muted">{n}</span>
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${s === 'Pago' ? 'bg-cta/10 text-cta' : 'bg-warning/10 text-warning'}`}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* selo flutuante */}
          <div className="absolute -bottom-4 -left-3 hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-card sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cta/10 text-cta"><Wallet size={15} /></div>
            <div>
              <p className="text-[10px] text-ink-muted">Recebido via PIX</p>
              <p className="text-xs font-bold text-ink">R$ 44.700</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
