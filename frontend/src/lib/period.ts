/** Helpers de período (mês / trimestre / semestre / ano) para o Financeiro. */

export type Period = 'month' | 'quarter' | 'half' | 'year';

export interface Range {
  from: string; // YYYY-MM-DD (inclusivo)
  to: string;   // YYYY-MM-DD (inclusivo)
  label: string;
  period: Period;
  /** Âncora usada para navegação: primeiro dia do período. */
  anchor: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Último dia do mês (mês 0-based). */
function lastDayOf(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** Constrói a janela para um período contendo a data `anchor` (YYYY-MM-DD). */
export function rangeFor(period: Period, anchor: string): Range {
  const [ay, am, ad] = anchor.split('-').map(Number);
  const d = new Date(ay, am - 1, ad || 1);
  const y = d.getFullYear();
  const m = d.getMonth(); // 0..11

  if (period === 'month') {
    const from = iso(y, m, 1);
    const to = iso(y, m, lastDayOf(y, m));
    const label = new Date(y, m, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { from, to, label, period, anchor: from };
  }
  if (period === 'quarter') {
    const q = Math.floor(m / 3); // 0..3
    const startM = q * 3;
    const endM = startM + 2;
    const from = iso(y, startM, 1);
    const to = iso(y, endM, lastDayOf(y, endM));
    const label = `${q + 1}º trimestre de ${y}`;
    return { from, to, label, period, anchor: from };
  }
  if (period === 'half') {
    const h = m < 6 ? 0 : 1; // 0..1
    const startM = h * 6;
    const endM = startM + 5;
    const from = iso(y, startM, 1);
    const to = iso(y, endM, lastDayOf(y, endM));
    const label = `${h + 1}º semestre de ${y}`;
    return { from, to, label, period, anchor: from };
  }
  // year
  const from = iso(y, 0, 1);
  const to = iso(y, 11, 31);
  return { from, to, label: String(y), period, anchor: from };
}

/** Vizinho anterior/posterior do período. */
export function shiftPeriod(r: Range, delta: 1 | -1): Range {
  const [y, m, d] = r.anchor.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  const step = { month: 1, quarter: 3, half: 6, year: 12 }[r.period];
  base.setMonth(base.getMonth() + step * delta);
  return rangeFor(r.period, iso(base.getFullYear(), base.getMonth(), 1));
}

/** Período que contém a data de hoje. */
export function todayRange(period: Period): Range {
  const now = new Date();
  return rangeFor(period, iso(now.getFullYear(), now.getMonth(), now.getDate()));
}
