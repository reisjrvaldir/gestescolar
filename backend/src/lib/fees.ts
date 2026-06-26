// =============================================================
//  Cálculo de taxa de serviço e split — pagamentos PIX
//
//  Regra (obrigatória):
//    taxa_nuvende_pix          = R$ 1,99 (fixo por PIX pago)
//    taxa_plataforma_percentual = valor_pago * 3%
//    taxa_total_servico        = 1,99 + (valor_pago * 0,03)
//    valor_liquido_escola      = valor_pago - taxa_total_servico
//
//  Contabilmente separamos: bruto, taxa Nuvende, taxa plataforma,
//  taxa total e líquido da escola.
// =============================================================

export const NUVENDE_PIX_FEE = 1.99;
export const PLATFORM_FEE_PERCENTAGE = 0.03;

export interface PixSplit {
  grossAmount: number;            // valor pago pelo responsável
  nuvendePixFee: number;          // taxa fixa Nuvende (1,99)
  platformFeePercentage: number;  // 0,03
  platformFeeAmount: number;      // receita da plataforma (gross * 3%)
  totalServiceFee: number;        // nuvende + plataforma
  schoolNetAmount: number;        // o que a escola recebe líquido
}

/** Arredonda para 2 casas (centavos), evitando erro de ponto flutuante. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula o split de um pagamento PIX confirmado.
 * @param grossAmount valor bruto pago (> 0)
 */
export function calculatePixSplit(grossAmount: number): PixSplit {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    throw new Error('grossAmount deve ser um número maior que zero');
  }

  const platformFeeAmount = round2(grossAmount * PLATFORM_FEE_PERCENTAGE);
  const totalServiceFee = round2(NUVENDE_PIX_FEE + platformFeeAmount);
  const schoolNetAmount = round2(grossAmount - totalServiceFee);

  return {
    grossAmount: round2(grossAmount),
    nuvendePixFee: NUVENDE_PIX_FEE,
    platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
    platformFeeAmount,
    totalServiceFee,
    schoolNetAmount,
  };
}
