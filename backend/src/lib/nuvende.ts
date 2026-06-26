// =============================================================
//  Camada de integração com o gateway de pagamento NUVENDE
//
//  A LÓGICA DE NEGÓCIO (split, persistência, saldo) está completa.
//  As CHAMADAS HTTP ao Nuvende estão marcadas como TODO — basta
//  plugar os endpoints/credenciais quando a documentação chegar.
//
//  Env esperadas (backend/.env e Vercel):
//    NUVENDE_API_KEY, NUVENDE_BASE_URL, NUVENDE_WEBHOOK_SECRET
// =============================================================
import type { PoolClient } from '@neondatabase/serverless';
import { calculatePixSplit } from './fees';

const API_KEY = process.env.NUVENDE_API_KEY;
const BASE_URL = process.env.NUVENDE_BASE_URL;
export const isNuvendeConfigured = Boolean(API_KEY && BASE_URL);

export interface PixChargeResult {
  providerChargeId: string;
  qrCode: string;       // imagem/base64 ou payload do QR
  copyPaste: string;    // PIX copia-e-cola
  amount: number;
}

/**
 * Cria uma cobrança PIX no Nuvende.
 * TODO(nuvende): substituir pela chamada real à API quando os docs chegarem:
 *   POST {BASE_URL}/charges  { billingType: 'PIX', value, dueDate, ... }
 *   Authorization: API_KEY
 * Por ora, em modo não configurado, retorna uma cobrança SIMULADA para
 * permitir testar o fluxo de ponta a ponta (split, saldo, webhook).
 */
export async function createPixCharge(input: {
  invoiceId: string;
  amount: number;
  description: string;
}): Promise<PixChargeResult> {
  if (!isNuvendeConfigured) {
    // SIMULAÇÃO (sem gateway real configurado)
    const fakeId = `sim_${input.invoiceId.slice(0, 8)}_${Date.now()}`;
    return {
      providerChargeId: fakeId,
      qrCode: `SIMULADO:${fakeId}`,
      copyPaste: `00020126SIMULADO-PIX-${fakeId}5204000053039865802BR`,
      amount: input.amount,
    };
  }

  // TODO(nuvende): chamada HTTP real.
  // const res = await fetch(`${BASE_URL}/charges`, { method:'POST',
  //   headers:{ 'Content-Type':'application/json', 'Authorization': API_KEY! },
  //   body: JSON.stringify({ billingType:'PIX', value: input.amount, ... }) });
  // const data = await res.json(); return { providerChargeId: data.id, qrCode: data.qr, copyPaste: data.payload, amount: input.amount };
  throw new Error('Integração HTTP Nuvende ainda não implementada (aguardando docs)');
}

/**
 * Valida a assinatura do webhook do Nuvende.
 * TODO(nuvende): implementar verificação real (HMAC/secret) conforme docs.
 */
export function verifyWebhookSignature(_rawBody: string, _signature?: string): boolean {
  const secret = process.env.NUVENDE_WEBHOOK_SECRET;
  if (!secret) return true; // modo simulação — sem gateway real configurado
  if (!_signature) return false;
  // TODO(nuvende): implementar HMAC-SHA256 quando docs chegarem.
  // Por segurança, REJEITAR até que a verificação real esteja implementada.
  return false;
}

/**
 * Processa um pagamento CONFIRMADO: calcula o split, grava payment +
 * payment_split, atualiza o saldo da escola e marca a fatura como paga.
 * Idempotente por provider_payment_id.
 * Esta é a parte de NEGÓCIO — totalmente implementada.
 */
export async function processConfirmedPayment(
  client: PoolClient,
  input: {
    schoolId: string;
    invoiceId: string;
    grossAmount: number;
    providerPaymentId: string;
    providerChargeId?: string;
  },
): Promise<{ applied: boolean; split: ReturnType<typeof calculatePixSplit> }> {
  const split = calculatePixSplit(input.grossAmount);

  // Idempotência: se já existe payment com esse provider_payment_id, não reaplica.
  const dup = await client.query(
    'select id from public.payments where provider_payment_id = $1 limit 1',
    [input.providerPaymentId],
  );
  if (dup.rows.length > 0) return { applied: false, split };

  // 1. payment
  const pay = await client.query(
    `insert into public.payments
       (school_id, invoice_id, gross_amount, payment_method, provider, provider_payment_id, provider_charge_id, status, paid_at)
     values ($1,$2,$3,'pix','nuvende',$4,$5,'confirmed',now())
     returning id`,
    [input.schoolId, input.invoiceId, input.grossAmount, input.providerPaymentId, input.providerChargeId ?? null],
  );
  const paymentId = pay.rows[0].id;

  // 2. payment_split (R$1,99 + 3%)
  await client.query(
    `insert into public.payment_splits
       (school_id, payment_id, invoice_id, gross_amount, nuvende_pix_fee, platform_fee_percentage,
        platform_fee_amount, total_service_fee, school_net_amount, split_status, reconciled_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'reconciled',now())`,
    [input.schoolId, paymentId, input.invoiceId, split.grossAmount, split.nuvendePixFee,
     split.platformFeePercentage, split.platformFeeAmount, split.totalServiceFee, split.schoolNetAmount],
  );

  // 3. saldo da escola (cria se não existir)
  await client.query(
    `insert into public.school_balances (school_id, available_balance, gross_received_total, platform_fees_total, provider_fees_total)
       values ($1,$2,$3,$4,$5)
     on conflict (school_id) do update set
       available_balance    = public.school_balances.available_balance    + $2,
       gross_received_total = public.school_balances.gross_received_total + $3,
       platform_fees_total  = public.school_balances.platform_fees_total  + $4,
       provider_fees_total  = public.school_balances.provider_fees_total  + $5,
       updated_at = now()`,
    [input.schoolId, split.schoolNetAmount, split.grossAmount, split.platformFeeAmount, split.nuvendePixFee],
  );

  // 4. fatura paga
  await client.query(
    `update public.invoices set status='paid', paid_at=now(), payment_method='pix' where id=$1 and school_id=$2`,
    [input.invoiceId, input.schoolId],
  );

  // 5. auditoria
  await client.query(
    `insert into public.audit_logs (school_id, action, entity_type, entity_id, metadata)
     values ($1,'PAYMENT_CONFIRMED','invoice',$2,$3)`,
    [input.schoolId, input.invoiceId, JSON.stringify({ providerPaymentId: input.providerPaymentId, split })],
  );

  return { applied: true, split };
}

/**
 * Solicita resgate (saque) do saldo disponível.
 * TODO(nuvende): chamar endpoint de transferência/saque do Nuvende.
 */
export async function requestWithdrawal(_input: { schoolId: string; amount: number }): Promise<{ providerWithdrawalId: string }> {
  if (!isNuvendeConfigured) return { providerWithdrawalId: `sim_wd_${Date.now()}` };
  throw new Error('Saque Nuvende ainda não implementado (aguardando docs)');
}

/**
 * Sincroniza/valida o status da conta de recebimento no Nuvende.
 * TODO(nuvende): consultar endpoint de status da conta/subconta.
 */
export async function syncAccountStatus(_schoolId: string): Promise<string> {
  return 'pending';
}
