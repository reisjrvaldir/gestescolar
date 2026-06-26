import { Check, QrCode, Copy } from 'lucide-react';

const BENEFITS = [
  'Gere cobranças com PIX em poucos cliques',
  'Acompanhe o status de cada pagamento em tempo real',
  'Valide sua conta e receba os repasses direto no sistema',
  'Tenha relatórios financeiros simples e completos',
  'Reduza o trabalho manual da secretaria',
];

const STATUS: { name: string; label: string; cls: string }[] = [
  { name: 'Ana Júlia', label: 'Pago', cls: 'bg-cta/10 text-cta' },
  { name: 'Pedro Henrique', label: 'Pendente', cls: 'bg-warning/10 text-warning' },
  { name: 'Maria Eduarda', label: 'Pago', cls: 'bg-cta/10 text-cta' },
  { name: 'João Gabriel', label: 'Atrasado', cls: 'bg-danger/10 text-danger' },
];

export function PixSection() {
  return (
    <section className="bg-surface">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
        {/* Esquerda */}
        <div>
          <span className="inline-block rounded-full bg-purple-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-purple">
            Diferencial GestEscolar
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">Cobrança integrada via PIX</h2>
          <p className="mt-3 text-ink-muted">
            Mais controle, agilidade e segurança para sua escola. Gere cobranças, acompanhe pagamentos,
            reduza inadimplência e receba os repasses diretamente pelo sistema.
          </p>
          <ul className="mt-6 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-ink">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cta/10 text-cta"><Check size={13} /></span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Direita — 3 cards */}
        <div className="space-y-4">
          {/* cobrança */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-muted">Cobrança via PIX</p>
                <p className="text-sm font-semibold text-ink">Mensalidade Junho/2026</p>
                <p className="mt-1 text-2xl font-extrabold text-ink">R$ 850,00</p>
              </div>
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-canvas">
                <QrCode size={56} className="text-ink" />
              </div>
            </div>
            <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cta py-2.5 text-sm font-bold text-white">
              <Copy size={15} /> Copiar código PIX
            </button>
          </div>

          {/* status */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <p className="mb-2 text-sm font-bold text-ink">Status dos pagamentos</p>
            {STATUS.map((row) => (
              <div key={row.name} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                <span className="text-sm text-ink-muted">{row.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.cls}`}>{row.label}</span>
              </div>
            ))}
          </div>

          {/* resumo */}
          <div className="grid grid-cols-2 gap-3">
            {[['Receitas do mês', 'R$ 48.200', 'text-ink'], ['Recebido via PIX', 'R$ 44.700', 'text-cta'], ['Pendente', 'R$ 3.500', 'text-warning'], ['Inadimplência', 'R$ 3.150', 'text-danger']].map(([l, v, c]) => (
              <div key={l} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
                <p className="text-xs text-ink-muted">{l}</p>
                <p className={`mt-1 text-lg font-extrabold ${c}`}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
