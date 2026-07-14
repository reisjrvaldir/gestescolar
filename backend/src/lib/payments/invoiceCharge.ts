// =============================================================
//  Cria a cobrança (PIX/cartão) de uma fatura já existente no banco e
//  persiste o retorno do provedor na própria fatura. Reaproveitado por:
//    - rotas de fatura (resposta imediata ao gestor)
//    - geração de mensalidades ao cadastrar aluno
//    - geração de cobranças avulsas (turma/todos)
// =============================================================
import type { PoolClient } from '@neondatabase/serverless';
import { getPaymentProvider, isAsaasConfigured } from './index';
import { calculatePixSplit } from '../fees';
import type { BillingType, CreateChargeInput, ChargeResult } from './types';

// Status da conta de recebimento que liberam a emissão de cobranças.
// Regra de negócio: a escola só pode RECEBER (gerar PIX/cobrança) depois de
// abrir a subconta E enviar os documentos — evita dinheiro caindo na conta
// principal da plataforma por uma escola ainda não habilitada no split.
const PAYOUT_READY_STATUSES = ['under_review', 'approved', 'active'];

export async function buildChargeForInvoice(
  c: PoolClient,
  schoolId: string,
  invoiceId: string,
  billingType: BillingType,
): Promise<{ error: 'not_found' | 'already_paid' | 'payout_not_ready' } | { charge: ChargeResult }> {
  const inv = await c.query(
    `select id, amount::float8 as amount, student_name, status, student_id
       from public.invoices where id=$1 and school_id=$2`,
    [invoiceId, schoolId],
  );
  if (inv.rows.length === 0) return { error: 'not_found' };
  const invoice = inv.rows[0];
  if (invoice.status === 'paid') return { error: 'already_paid' };

  // Com ASAAS ativo, exige conta de recebimento habilitada (subconta + docs
  // enviados) antes de gerar qualquer cobrança. Em simulação não se aplica.
  if (isAsaasConfigured) {
    const acc = await c.query(
      `select na.status, s.asaas_wallet_id
         from public.schools s
         left join public.nuvende_accounts na on na.school_id = s.id
        where s.id = $1`,
      [schoolId],
    );
    const row = acc.rows[0] ?? {};
    const ready = Boolean(row.asaas_wallet_id) && PAYOUT_READY_STATUSES.includes(row.status);
    if (!ready) return { error: 'payout_not_ready' };
  }

  const chargeInput: CreateChargeInput = {
    invoiceId: invoice.id,
    amount: Number(invoice.amount),
    description: `Mensalidade — ${invoice.student_name}`,
    billingType,
  };

  if (isAsaasConfigured) {
    const ctxRow = await c.query(
      `select g.name, g.cpf, g.email, g.phone, g.asaas_customer_id, s.asaas_wallet_id
         from public.invoices i
         left join public.students st on st.id = i.student_id
         left join public.guardians g on g.id = st.guardian_id
         left join public.schools s on s.id = i.school_id
        where i.id=$1 and i.school_id=$2`,
      [invoiceId, schoolId],
    );
    const r = ctxRow.rows[0] ?? {};
    chargeInput.customer = {
      name: r.name ?? invoice.student_name,
      cpfCnpj: r.cpf ?? undefined,
      email: r.email ?? undefined,
      phone: r.phone ?? undefined,
      providerCustomerId: r.asaas_customer_id ?? undefined,
    };
    if (r.asaas_wallet_id) {
      const split = calculatePixSplit(Number(invoice.amount));
      chargeInput.split = [{ walletId: r.asaas_wallet_id, fixedValue: split.schoolNetAmount }];
    }
  }

  const charge = await getPaymentProvider().createCharge(chargeInput);

  await c.query(
    `update public.invoices
        set nuvende_charge_id=$1, pix_qr_code=$2, pix_copy_paste=$3, payment_method=$4,
            billing_type=$5, checkout_url=$6
      where id=$7`,
    [charge.providerChargeId, charge.pixQrCode ?? null, charge.pixCopyPaste ?? null,
     billingType === 'CREDIT_CARD' ? 'card' : 'pix', billingType, charge.invoiceUrl ?? null, invoice.id],
  );

  if (isAsaasConfigured && charge.providerCustomerId && invoice.student_id) {
    await c.query(
      `update public.guardians set asaas_customer_id=$1
         where id = (select guardian_id from public.students where id=$2) and asaas_customer_id is null`,
      [charge.providerCustomerId, invoice.student_id],
    );
  }

  return { charge };
}
