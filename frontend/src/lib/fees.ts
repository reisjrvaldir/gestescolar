// Espelho do cálculo de split do backend (backend/src/lib/fees.ts).
// Regra PIX: taxa Nuvende R$1,99 + 3% da plataforma sobre o valor pago.

export const NUVENDE_PIX_FEE = 1.99;
export const PLATFORM_FEE_PERCENTAGE = 0.03;

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
  const totalServiceFee = round2(NUVENDE_PIX_FEE + platformFeeAmount);
  return {
    grossAmount: round2(grossAmount),
    nuvendePixFee: NUVENDE_PIX_FEE,
    platformFeeAmount,
    totalServiceFee,
    schoolNetAmount: round2(grossAmount - totalServiceFee),
  };
}

export const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
