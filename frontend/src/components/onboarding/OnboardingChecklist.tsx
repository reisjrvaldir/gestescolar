import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight, X } from 'lucide-react';
import { api } from '@/lib/api';

interface OnboardingStatus {
  has_plan: boolean;
  has_class: boolean;
  has_staff: boolean;
  has_student: boolean;
  payment_ready: boolean;
  complete: boolean;
}

const STEPS = [
  {
    key: 'has_plan' as const,
    label: 'Crie um plano de mensalidade',
    description: 'Defina o valor mensal que os alunos pagarão.',
    path: '/planos',
  },
  {
    key: 'has_class' as const,
    label: 'Cadastre as turmas',
    description: 'Organize os alunos por ano, turno e nível.',
    path: '/turmas',
  },
  {
    key: 'has_staff' as const,
    label: 'Adicione professores',
    description: 'Convide a equipe da escola para o sistema.',
    path: '/funcionarios',
  },
  {
    key: 'has_student' as const,
    label: 'Matricule o primeiro aluno',
    description: 'Cadastre um aluno e vincule a uma turma e plano.',
    path: '/alunos',
  },
  {
    key: 'payment_ready' as const,
    label: 'Configure o recebimento',
    description: 'Ative o PIX/boleto abrindo sua subconta de pagamentos.',
    path: '/financeiro/recebimento',
  },
];

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('onboarding_dismissed') === '1');

  useEffect(() => {
    api.get<{ ok: boolean; data: OnboardingStatus }>('/onboarding/status')
      .then((r) => setStatus(r.data))
      .catch(() => {});
  }, []);

  if (dismissed || !status || status.complete) return null;

  const done = STEPS.filter((s) => status[s.key]).length;
  const total = STEPS.length;
  const pct = Math.round((done / total) * 100);

  function dismiss() {
    localStorage.setItem('onboarding_dismissed', '1');
    setDismissed(true);
  }

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-primary-soft/30 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-ink">Configure sua escola</h3>
          <p className="text-sm text-ink-muted">
            Complete os passos abaixo para começar a usar o sistema.&nbsp;
            <span className="font-semibold text-primary">{done} de {total} concluídos</span>
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-ink-muted hover:bg-primary-soft hover:text-primary"
          title="Dispensar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-2">
        {STEPS.map((step, i) => {
          const isDone = status[step.key];
          return (
            <button
              key={step.key}
              onClick={() => !isDone && navigate(step.path)}
              disabled={isDone}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors
                ${isDone
                  ? 'cursor-default opacity-60'
                  : 'hover:bg-primary-soft cursor-pointer'
                }`}
            >
              <span className="shrink-0">
                {isDone
                  ? <CheckCircle2 size={20} className="text-success" />
                  : <Circle size={20} className="text-primary/40" />
                }
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-semibold ${isDone ? 'line-through text-ink-muted' : 'text-ink'}`}>
                  {i + 1}. {step.label}
                </span>
                {!isDone && (
                  <span className="block text-xs text-ink-muted">{step.description}</span>
                )}
              </span>
              {!isDone && <ChevronRight size={16} className="shrink-0 text-primary/50" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
