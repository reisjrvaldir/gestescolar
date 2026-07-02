// =============================================================
//  Cálculo de split — pagamentos PIX/cartão via ASAAS
//
//  Regra (obrigatória):
//    taxa_plataforma = valor_pago * 5%
//    valor_liquido_escola = valor_pago - taxa_plataforma
//
//  A taxa cobrada pelo gateway (ASAAS) é absorvida pelos 5% da plataforma —
//  não é repassada separadamente à escola.
// =============================================================

export const PLATFORM_FEE_PERCENTAGE = 0.05;

export interface PixSplit {
  grossAmount: number;            // valor pago pelo responsável
  nuvendePixFee: number;          // taxa fixa do gateway (0 — absorvida na taxa da plataforma)
  platformFeePercentage: number;  // 0,05
  platformFeeAmount: number;      // receita da plataforma (gross * 5%)
  totalServiceFee: number;        // = platformFeeAmount (sem taxa fixa separada)
  schoolNetAmount: number;        // o que a escola recebe líquido
}

/** Arredonda para 2 casas (centavos), evitando erro de ponto flutuante. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula o split de um pagamento confirmado (PIX ou cartão).
 * @param grossAmount valor bruto pago (> 0)
 */
export function calculatePixSplit(grossAmount: number): PixSplit {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    throw new Error('grossAmount deve ser um número maior que zero');
  }

  const platformFeeAmount = round2(grossAmount * PLATFORM_FEE_PERCENTAGE);
  const totalServiceFee = platformFeeAmount;
  const schoolNetAmount = round2(grossAmount - totalServiceFee);

  return {
    grossAmount: round2(grossAmount),
    nuvendePixFee: 0,
    platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
    platformFeeAmount,
    totalServiceFee,
    schoolNetAmount,
  };
}
