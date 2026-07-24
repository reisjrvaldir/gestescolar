// Utilitários de dinheiro no padrão brasileiro (R$ 10.000,00).

export const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

/** Converte string vinda de um input com máscara ("10.000,00") em número (10000). */
export function parseBRL(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Formata um número para "10.000,00" (sem "R$"). */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

/** Recebe apenas dígitos e devolve string mascarada em centavos ("10.000,00"). */
export function maskBRLFromDigits(digits: string): string {
  const only = digits.replace(/\D/g, '').slice(0, 15) || '0';
  const cents = Number(only);
  return formatBRL(cents / 100);
}
