/** Helpers de navegação por mês (chave "YYYY-MM"). */

/** "YYYY-MM" do mês atual (horário local). */
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Extrai "YYYY-MM" de uma data ISO (YYYY-MM-DD). Retorna null se inválida. */
export function monthKeyOf(iso?: string | null): string | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : null;
}

/** Rótulo "julho de 2026" a partir de "YYYY-MM". */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/** Move a chave YYYY-MM em N meses (positivo ou negativo). */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
