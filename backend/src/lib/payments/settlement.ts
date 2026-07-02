// =============================================================
//  Liquidação de pagamento (agnóstica de provedor).
//  Calcula o split, grava payment + payment_split, atualiza saldo da escola
//  e marca a fatura como paga. Idempotente por provider_payment_id.
// =============================================================
import type { PoolClient } from '@neondatabase/serverless';
import { calculatePixSplit } from '../fees';

export async function processConfirmedPayment(
  client: PoolClient,
  input: {
    schoolId: string;
    invoiceId: string;
    grossAmount: number;
    providerPaymentId: string;
    providerChargeId?: string;
    provider?: string;                       // 'asaas' | 'simulation' | ...
    paymentMethod?: 'pix' | 'credit_card';
  },
): Promise<{ applied: boolean; split: ReturnType<typeof calculatePixSplit> }> {
  const split = calculatePixSplit(input.grossAmount);
  const provider = input.provider ?? 'asaas';
  const method = input.paymentMethod ?? 'pix';

  // Idempotência: mesmo provider_payment_id não reaplica.
  const dup = await client.query(
    'select id from public.payments where provider_payment_id = $1 limit 1',
    [input.providerPaymentId],
  );
  if (dup.rows.length > 0) return { applied: false, split };

  // 1. payment
  const pay = await client.query(
    `insert into public.payments
       (school_id, invoice_id, gross_amount, payment_method, provider, provider_payment_id, provider_charge_id, status, paid_at)
     values ($1,$2,$3,$4,$5,$6,$7,'confirmed',now())
     returning id`,
    [input.schoolId, input.invoiceId, input.grossAmount, method, provider,
     input.providerPaymentId, input.providerChargeId ?? null],
  );
  const paymentId = pay.rows[0].id;

  // 2. payment_split (taxa fixa do gateway + 3% plataforma)
  //    (colunas do schema mantêm o nome nuvende_pix_fee = taxa fixa do gateway)
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
    `update public.invoices set status='paid', paid_at=now(), payment_method=$3 where id=$1 and school_id=$2`,
    [input.invoiceId, input.schoolId, method],
  );

  // 5. auditoria
  await client.query(
    `insert into public.audit_logs (school_id, action, entity_type, entity_id, metadata)
     values ($1,'PAYMENT_CONFIRMED','invoice',$2,$3)`,
    [input.schoolId, input.invoiceId, JSON.stringify({ provider, providerPaymentId: input.providerPaymentId, split })],
  );

  return { applied: true, split };
}

/**
 * Liquida um pagamento de ASSINATURA SaaS (a escola pagando a plataforma).
 * Não há split (100% é receita da plataforma): apenas confirma o pagamento,
 * ativa a assinatura/escola e renova o período vigente.
 */
export async function processSubscriptionPayment(
  client: PoolClient,
  input: {
    schoolId: string;
    planId: string | null;
    cycle: 'monthly' | 'annual';
    grossAmount: number;
    providerPaymentId: string;
    providerChargeId?: string;
    provider?: string;
  },
): Promise<{ applied: boolean }> {
  const provider = input.provider ?? 'asaas';

  const dup = await client.query(
    'select id from public.payments where provider_payment_id = $1 limit 1',
    [input.providerPaymentId],
  );
  if (dup.rows.length > 0) return { applied: false };

  // Assinatura mais recente da escola para este plano.
  const subRow = await client.query(
    `select id from public.subscriptions
      where school_id=$1 and ($2::uuid is null or plan_id=$2)
      order by created_at desc limit 1`,
    [input.schoolId, input.planId],
  );
  const subscriptionId = subRow.rows[0]?.id ?? null;

  await client.query(
    `insert into public.payments
       (school_id, subscription_id, gross_amount, payment_method, provider, provider_payment_id, provider_charge_id, status, paid_at)
     values ($1,$2,$3,'credit_card',$4,$5,$6,'confirmed',now())`,
    [input.schoolId, subscriptionId, input.grossAmount, provider, input.providerPaymentId, input.providerChargeId ?? null],
  );

  const periodInterval = input.cycle === 'annual' ? '1 year' : '1 month';
  if (subscriptionId) {
    await client.query(
      `update public.subscriptions
          set status='active', amount=$2, billing_cycle=$3,
              current_period_start=now(), current_period_end = now() + $4::interval,
              checkout_url = null, updated_at = now()
        where id=$1`,
      [subscriptionId, input.grossAmount, input.cycle, periodInterval],
    );
  }

  await client.query(
    `update public.schools set subscription_status='active', trial_ends_at=null where id=$1`,
    [input.schoolId],
  );

  await client.query(
    `insert into public.audit_logs (school_id, action, entity_type, entity_id, metadata)
     values ($1,'SUBSCRIPTION_PAYMENT_CONFIRMED','subscription',$2,$3)`,
    [input.schoolId, subscriptionId, JSON.stringify({ provider, providerPaymentId: input.providerPaymentId, cycle: input.cycle, amount: input.grossAmount })],
  );

  return { applied: true };
}
