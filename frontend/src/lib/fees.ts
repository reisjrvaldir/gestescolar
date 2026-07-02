// Espelho do cálculo de split do backend (backend/src/lib/fees.ts).
// Regra: taxa da plataforma = 5% sobre o valor pago (PIX ou cartão via ASAAS).

export const PLATFORM_FEE_PERCENTAGE = 0.05;

export interface PixSplit {
  grossAmount: number;
  nuvendePixFee: number;
  platformFeeAmount: number;
  totalServiceFee: number;
  schoolNetAmount: number;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function calculatePixSplit(grossAmount: number): PixSplit {
  const platformFeeAmount = round2(grossAmount * PLATFORM_FEE_PERCENTAGE);
  return {
    grossAmount: round2(grossAmount),
    nuvendePixFee: 0,
    platformFeeAmount,
    totalServiceFee: platformFeeAmount,
    schoolNetAmount: round2(grossAmount - platformFeeAmount),
  };
}

export const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
