import { useNavigate } from 'react-router-dom';
import {
  HelpCircle, Wallet, Percent, Star, School2, GraduationCap, Users,
  BookOpen, FileText, ArrowRight, type LucideIcon,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';

interface Step {
  number: number;
  icon: LucideIcon;
  title: string;
  body: string[];
  cta: { label: string; to: string };
}

const STEPS: Step[] = [
  {
    number: 1,
    icon: Wallet,
    title: 'Configure o plano de mensalidade',
    body: [
      'Antes de matricular alunos, cadastre pelo menos um plano de mensalidade: nome (ex.: "Fundamental I"), valor mensal e taxa de matrícula (opcional).',
      'Você pode ter vários planos ativos ao mesmo tempo — cada aluno é vinculado a um deles na hora da matrícula, e é esse valor que gera a cobrança PIX todo mês.',
    ],
    cta: { label: 'Ir para Configurações', to: '/app/settings' },
  },
  {
    number: 2,
    icon: Percent,
    title: 'Aplique multa e juros por atraso',
    body: [
      'Na mesma tela de Configurações, defina a multa (percentual único, cobrado uma vez sobre o valor em atraso) e os juros de mora (percentual ao mês, proporcional aos dias de atraso).',
      'Essas taxas são repassadas automaticamente para o provedor de pagamento e aplicadas apenas às cobranças geradas depois que você salvar — faturas já emitidas não mudam retroativamente.',
    ],
    cta: { label: 'Ir para Configurações', to: '/app/settings' },
  },
  {
    number: 3,
    icon: Star,
    title: 'Defina a nota de média e a nota de recuperação',
    body: [
      'Em Lançar Notas → Configurações de Avaliação, existem dois números que decidem a situação final do aluno:',
      '"Aprovação" é a média mínima para passar direto, sem precisar de recuperação. "Mínimo Final" é a nota mínima depois de somar a recuperação — abaixo dela o aluno fica reprovado.',
      'Exemplo comum: Aprovação 7,0 e Mínimo Final 5,0. Quem tira média 8 passa direto; quem tira 6 vai pra recuperação e precisa fechar em pelo menos 5 depois dela.',
    ],
    cta: { label: 'Ir para Lançar Notas', to: '/app/grades' },
  },
  {
    number: 4,
    icon: School2,
    title: 'Crie suas turmas — e vincule os professores',
    body: [
      'Em Turmas → "Nova turma", preencha nome, ano letivo, turno e nível. É nessa mesma tela que os professores entram: o campo "Professor responsável" define o regente da turma, e a seção "Matérias e professores da turma" deixa marcar cada matéria e escolher um professor por disciplina — assim vários professores atuam na mesma turma, um por matéria.',
      'Se os funcionários ainda não estiverem cadastrados (passo 6), pode criar a turma sem professor por enquanto e voltar depois em "Editar turma" pra vincular.',
      'Importante: a tela de Turmas só permite ver os alunos de cada turma (lista somente leitura) — não é onde você adiciona aluno. Isso é feito no cadastro do aluno, no passo seguinte.',
    ],
    cta: { label: 'Ir para Turmas', to: '/app/classes' },
  },
  {
    number: 5,
    icon: GraduationCap,
    title: 'Adicione os alunos — e vincule a turma dele',
    body: [
      'Em Alunos → "Novo aluno", preencha os dados do aluno e do responsável financeiro. O campo "Turma" (dropdown) é onde você faz a matrícula dele na turma que criou no passo anterior — é assim, pelo cadastro do aluno, que a vinculação acontece, não pela tela de Turmas.',
      'Escolha também o plano de mensalidade (passo 1) nesse mesmo formulário. O sistema gera a matrícula e já libera o acesso do responsável pelo portal, se você criar a conta dele.',
    ],
    cta: { label: 'Ir para Alunos', to: '/app/students' },
  },
  {
    number: 6,
    icon: Users,
    title: 'Adicione os funcionários',
    body: [
      'Cadastre professores e equipe administrativa, definindo a função de cada um (professor, coordenação, financeiro). É esse cadastro que dá acesso ao sistema — cada funcionário recebe um login próprio.',
    ],
    cta: { label: 'Ir para Funcionários', to: '/app/staff' },
  },
  {
    number: 7,
    icon: BookOpen,
    title: 'Como funciona o planejamento de aula semanal',
    body: [
      'Cada professor monta o plano da semana por turma e matéria: objetivos, conteúdo, metodologia, recursos e avaliação — e pode detalhar dia a dia (segunda a sexta) com conteúdo, atividade e tarefa de casa.',
      'Quando o professor manda o plano para revisão, a coordenação pode aprovar, comentar ou pedir ajuste — o professor edita e reenvia até ser aprovado.',
      'A coordenação também pode definir temas da semana (ex.: "Semana da Água") que valem pra escola inteira; os professores veem esses temas ao montar o próprio planejamento.',
    ],
    cta: { label: 'Ir para Planejamento', to: '/app/lesson-plans' },
  },
  {
    number: 8,
    icon: FileText,
    title: 'Notas e boletim',
    body: [
      'Em Lançar Notas, cada professor registra as notas por matéria e período (bimestre/trimestre) da sua turma.',
      'O Boletim consolida automaticamente essas notas e calcula a situação de cada aluno usando as notas de corte configuradas no passo 3: aprovado, em recuperação ou reprovado.',
      'O responsável enxerga o boletim do próprio filho pelo portal — sem precisar pedir pra secretaria.',
    ],
    cta: { label: 'Ir para Boletim', to: '/app/grades/boletim' },
  },
];

export function HelpCenterPage() {
  const navigate = useNavigate();

  return (
    <>
      <PageHero
        title="Central de Ajuda"
        subtitle="Passo a passo para configurar e usar o GestEscolar."
        icon={HelpCircle}
      />

      <div className="space-y-4">
        {STEPS.map((step) => (
          <div key={step.number} className="card flex gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <step.icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-bold text-ink-subtle">Passo {step.number}</span>
              </div>
              <h3 className="text-base font-bold text-ink">{step.title}</h3>
              <div className="mt-1.5 space-y-2">
                {step.body.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink-muted">{p}</p>
                ))}
              </div>
              <button
                className="btn-outline mt-3 text-xs"
                onClick={() => navigate(step.cta.to)}
              >
                {step.cta.label} <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
