// Série mockada de receitas x despesas dos últimos 12 meses.
// Integração futura: GET /api/finance/monthly-balance → [{ month, receitas, despesas }].

export interface MonthBalance {
  month: string;   // rótulo curto (ex.: 'Mai/25')
  receitas: number;
  despesas: number;
}

export const financeChartData: MonthBalance[] = [
  { month: 'Jun/24', receitas: 142300, despesas: 51200 },
  { month: 'Jul/24', receitas: 138900, despesas: 49800 },
  { month: 'Ago/24', receitas: 151400, despesas: 55100 },
  { month: 'Set/24', receitas: 149700, despesas: 53400 },
  { month: 'Out/24', receitas: 156200, despesas: 56800 },
  { month: 'Nov/24', receitas: 158900, despesas: 57300 },
  { month: 'Dez/24', receitas: 147500, despesas: 60100 },
  { month: 'Jan/25', receitas: 160300, despesas: 54900 },
  { month: 'Fev/25', receitas: 158100, despesas: 55600 },
  { month: 'Mar/25', receitas: 162800, despesas: 57900 },
  { month: 'Abr/25', receitas: 161200, despesas: 56400 },
  { month: 'Mai/25', receitas: 165340, despesas: 58210 },
];
