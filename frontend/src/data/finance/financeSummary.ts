// Dados mockados do resumo financeiro (Visão geral).
// Preparado para integração: substitua `financeSummary` por dados vindos de
// GET /api/finance/summary (ou /api/dashboard/stats) mantendo o mesmo formato.

export type SummaryIcon = 'revenue' | 'expense' | 'balance' | 'alert';
export type Tone = 'primary' | 'success' | 'danger' | 'purple';

export interface SummaryCard {
  key: string;
  label: string;
  value: number;
  deltaLabel: string;
  /** 'success' = variação positiva para a escola; 'danger' = negativa. */
  deltaTone: 'success' | 'danger';
  tone: Tone;
  icon: SummaryIcon;
}

export const financeSummary: SummaryCard[] = [
  {
    key: 'receita',
    label: 'Previsão de receita do mês',
    value: 165340,
    deltaLabel: '+12,8% vs mês anterior',
    deltaTone: 'success',
    tone: 'success',
    icon: 'revenue',
  },
  {
    key: 'despesas',
    label: 'Despesas do mês',
    value: 58210,
    deltaLabel: '+8,6% vs mês anterior',
    deltaTone: 'danger',
    tone: 'danger',
    icon: 'expense',
  },
  {
    key: 'saldo',
    label: 'Saldo do mês',
    value: 107130,
    deltaLabel: '+19,2% vs mês anterior',
    deltaTone: 'success',
    tone: 'primary',
    icon: 'balance',
  },
  {
    key: 'inadimplencia',
    label: 'Inadimplência',
    value: 18760,
    deltaLabel: '+4,3% vs mês anterior',
    deltaTone: 'danger',
    tone: 'purple',
    icon: 'alert',
  },
];
