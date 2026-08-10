import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    selector: '[data-tour-section="Gestão"]',
    title: 'Gestão',
    body: 'Aqui você cadastra alunos, funcionários e turmas — o ponto de partida da sua escola no sistema.',
  },
  {
    selector: '[data-tour-section="Acadêmico"]',
    title: 'Acadêmico',
    body: 'Planejamento de aula, notas, boletim, frequência e calendário — tudo organizado por turma.',
  },
  {
    selector: '[data-tour-section="Financeiro"]',
    title: 'Financeiro',
    body: 'Configure seu plano de mensalidade, juros por atraso, e acompanhe pagamentos e inadimplência.',
  },
  {
    selector: '[data-tour-target="ajuda"]',
    title: 'Central de Ajuda',
    body: 'Sempre que precisar, volte aqui: passo a passo completo de cada etapa, com atalho direto pra cada tela.',
  },
];

const STORAGE_KEY = 'ges_tour_v1_done';

/** Tour de spotlight no primeiro acesso do gestor — destaca a sidebar real,
 *  não uma tela fake. Só roda em telas grandes (a sidebar some no mobile). */
export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (window.innerWidth < 1024) return; // sidebar fixa só existe em telas grandes
    // Pequeno atraso pra garantir que a sidebar já montou antes de medir a posição.
    const t = setTimeout(() => setActive(true), 700);
    return () => clearTimeout(t);
  }, []);

  const updateRect = useCallback(() => {
    const el = document.querySelector(STEPS[stepIndex].selector);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [stepIndex]);

  useEffect(() => {
    if (!active) return;
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [active, updateRect]);

  function finish() {
    localStorage.setItem(STORAGE_KEY, '1');
    setActive(false);
  }

  function next() {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
    else finish();
  }

  if (!active || !rect) return null;

  const step = STEPS[stepIndex];
  const pad = 8;
  const tooltipTop = Math.min(Math.max(16, rect.top), window.innerHeight - 200);
  const tooltipLeft = Math.min(rect.right + 16, window.innerWidth - 300);

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed z-[95] rounded-xl transition-all duration-300"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: '0 0 0 9999px rgba(15,15,26,0.65)',
          pointerEvents: 'none',
        }}
      />
      <div
        role="dialog"
        aria-label={`Tour: ${step.title}`}
        className="fixed z-[96] w-72 rounded-2xl bg-surface p-4 shadow-card-hover transition-all duration-300"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
            {stepIndex + 1} / {STEPS.length}
          </span>
          <button onClick={finish} className="rounded p-0.5 text-ink-muted hover:text-ink" aria-label="Pular tour">
            <X size={15} />
          </button>
        </div>
        <h3 className="text-sm font-bold text-ink">{step.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{step.body}</p>
        <div className="mt-3 flex items-center justify-end gap-3">
          <button className="text-xs font-medium text-ink-muted hover:text-ink" onClick={finish}>Pular</button>
          <button className="btn-primary text-xs" onClick={next}>
            {stepIndex < STEPS.length - 1 ? 'Próximo' : 'Concluir'} <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </>
  );
}
