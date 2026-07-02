// Dados mockados da landing — fáceis de editar.
import {
  UserPlus, Wallet, QrCode, BarChart3, GraduationCap, Users,
  type LucideIcon,
} from 'lucide-react';

export interface Feature { icon: LucideIcon; title: string; desc: string; }
export const FEATURES: Feature[] = [
  { icon: UserPlus, title: 'Cadastro de alunos e responsáveis', desc: 'Cadastre alunos, responsáveis, documentos e dados escolares com segurança e praticidade.' },
  { icon: Wallet, title: 'Gestão financeira', desc: 'Controle mensalidades, despesas, inadimplência e relatórios financeiros em um painel simples.' },
  { icon: QrCode, title: 'Cobrança via PIX', desc: 'Emita cobranças com PIX, acompanhe pagamentos e reduza a inadimplência da sua escola.' },
  { icon: BarChart3, title: 'Relatórios inteligentes', desc: 'Visualize indicadores acadêmicos e financeiros para tomar decisões com mais segurança.' },
  { icon: GraduationCap, title: 'Controle acadêmico', desc: 'Gerencie turmas, notas, frequência, planos de aula e informações pedagógicas em um só lugar.' },
  { icon: Users, title: 'Acesso multiusuário', desc: 'Defina permissões para gestores, secretaria, financeiro, professores e responsáveis.' },
];

export interface Step { n: number; title: string; desc: string; }
export const STEPS: Step[] = [
  { n: 1, title: 'Cadastre sua escola', desc: 'Crie sua conta e configure os dados da instituição em poucos minutos.' },
  { n: 2, title: 'Organize alunos e turmas', desc: 'Cadastre alunos, responsáveis, professores, turmas e permissões de acesso.' },
  { n: 3, title: 'Receba mensalidades', desc: 'Emita cobranças via PIX e acompanhe os pagamentos com agilidade.' },
  { n: 4, title: 'Acompanhe em tempo real', desc: 'Veja relatórios, inadimplência, alunos e indicadores em um painel completo.' },
];

export interface ModuleItem { title: string; desc: string; }
export const MODULES: ModuleItem[] = [
  { title: 'Painel administrativo', desc: 'Tenha uma visão completa da sua escola com indicadores em tempo real.' },
  { title: 'Financeiro completo', desc: 'Controle receitas, despesas, cobranças, inadimplência e conciliação financeira.' },
  { title: 'Gestão de alunos', desc: 'Acompanhe matrícula, frequência, boletins, documentos e histórico acadêmico.' },
  { title: 'Documentos e contratos', desc: 'Armazene documentos, contratos e autorizações com segurança e acesso rápido.' },
];

