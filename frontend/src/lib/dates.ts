/**
 * Formata uma data vinda da API (coluna DATE do Postgres) para pt-BR.
 * Aceita tanto 'YYYY-MM-DD' quanto ISO completo com horário/timezone —
 * o driver do banco pode serializar DATE como um Date completo (ex.:
 * "2026-07-10T00:00:00.000Z"). Renderiza sempre em UTC para não sofrer
 * deslocamento de dia por causa do fuso local do navegador.
 */
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
