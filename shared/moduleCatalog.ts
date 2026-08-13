// Catálogo de módulos que o gestor pode ativar/desativar.
// Módulos "core" (Dashboard, Alunos, Funcionários, Turmas, Financeiro básico,
// Faturas, Configurações, Ajuda) NÃO aparecem aqui — ficam sempre visíveis.
//
// Regra de leitura: ausência da chave em `enabled_modules` = módulo ativo
// (default true). Só marcamos explicitamente `false` quando o gestor desativa.

export type ModuleKey =
  | 'calendar'
  | 'lesson_plans'
  | 'grades'
  | 'attendance'
  | 'timeclock'
  | 'leave_requests'
  | 'staff_docs'
  | 'delinquency'
  | 'messages'
  | 'tickets';

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  description: string;
}

export const MODULE_CATALOG: ModuleDef[] = [
  { key: 'calendar',       label: 'Ano Letivo / Calendário',  description: 'Calendário escolar com feriados, provas, reuniões e eventos.' },
  { key: 'lesson_plans',   label: 'Planejamento de aulas',    description: 'Professor monta o plano semanal; coordenação revisa e aprova.' },
  { key: 'grades',         label: 'Notas e Boletim',          description: 'Lançamento de notas por bimestre/trimestre e boletim consolidado.' },
  { key: 'attendance',     label: 'Chamada e Atestados',      description: 'Registro diário de presença e fluxo de atestados médicos.' },
  { key: 'timeclock',      label: 'Ponto eletrônico',         description: 'Bater ponto pelo sistema, com relatório de horas e banco.' },
  { key: 'leave_requests', label: 'Folgas e Férias',          description: 'Pedidos de folga/férias com aprovação da gestão.' },
  { key: 'staff_docs',     label: 'Documentos do funcionário', description: 'Upload de contratos, certificados e comprovantes por colaborador.' },
  { key: 'delinquency',    label: 'Inadimplência',            description: 'Painel dedicado com KPIs, ranking e cobrança de atrasados.' },
  { key: 'messages',       label: 'Mensagens internas',       description: 'Comunicação entre gestão, professores e responsáveis.' },
  { key: 'tickets',        label: 'Chamados de suporte',      description: 'Canal interno para a escola registrar problemas do sistema.' },
];

export type EnabledModules = Partial<Record<ModuleKey, boolean>>;

/** True se o módulo está ativo para esta escola (default: true quando ausente). */
export function isModuleEnabled(map: EnabledModules | null | undefined, key: ModuleKey): boolean {
  if (!map) return true;
  return map[key] !== false;
}
