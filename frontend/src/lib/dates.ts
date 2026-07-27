/**
 * Utilitários de data centralizados.
 *
 * Distinção fundamental:
 *  - Colunas DATE do Postgres chegam como "YYYY-MM-DD" (string sem timezone).
 *    Tratá-las com new Date("YYYY-MM-DD") interpreta UTC midnight → no fuso
 *    BRT (-3 h) vira 21 h do dia anterior → data exibida errada.
 *    Solução: parsear a string diretamente, sem criar um objeto Date.
 *
 *  - Colunas TIMESTAMPTZ chegam como "2026-07-15T03:00:00.000Z" (UTC real).
 *    Devem ser exibidas no fuso America/Recife (UTC-3, sem horário de verão).
 */

const BRT = 'America/Recife';

// ---------------------------------------------------------------------------
// DATE puro (sem horário) — YYYY-MM-DD
// ---------------------------------------------------------------------------

/**
 * Decompõe uma string "YYYY-MM-DD" sem criar um objeto Date.
 * Retorna null para entradas vazias ou malformadas.
 */
export function parseDateOnly(
  s: string | null | undefined,
): { year: number; month: number; day: number } | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
}

/**
 * Formata coluna DATE do Postgres para pt-BR (DD/MM/AAAA)
 * sem nenhuma conversão de fuso.
 */
export function formatDateOnlyPtBR(s: string | null | undefined): string {
  const p = parseDateOnly(s);
  if (!p) return '—';
  return (
    String(p.day).padStart(2, '0') +
    '/' +
    String(p.month).padStart(2, '0') +
    '/' +
    p.year
  );
}

/**
 * Alias para formatDateOnlyPtBR — mantido para compatibilidade com código
 * existente. Aceita tanto "YYYY-MM-DD" quanto ISO completo com horário/tz;
 * em ambos os casos extrai apenas a parte da data (slice 0-10).
 */
export function fmtDate(iso?: string | null): string {
  return formatDateOnlyPtBR(iso);
}

// ---------------------------------------------------------------------------
// TIMESTAMPTZ (momento real) — exibir em America/Recife
// ---------------------------------------------------------------------------

/**
 * Formata TIMESTAMPTZ no fuso America/Recife (UTC-3, sem DST).
 * Usar para campos como paid_at, created_at, revealed_at.
 */
export function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: BRT });
}

/**
 * Retorna o ano do TIMESTAMPTZ no fuso America/Recife.
 * Útil para filtros de comprovante IR: um pagamento às 22 h BRT em 31/12
 * deve pertencer ao ano corrente, não ao seguinte.
 */
export function getYearBRT(iso: string | null | undefined): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Number(new Intl.DateTimeFormat('pt-BR', { timeZone: BRT, year: 'numeric' }).format(d));
}
