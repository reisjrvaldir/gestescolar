import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  isAsaasConfigured, asaasEnsureBillingCustomer, asaasCreateSubscription, asaasCreateInstallmentCharge,
} from '../../lib/payments';

export const billingRouter = Router();
billingRouter.use(requireAuth);

const subscribeSchema = z.object({
  plan_id: z.string().uuid(),
  cycle: z.enum(['monthly', 'annual']),
  installments: z.number().int().min(1).max(12).optional(),
});

// POST /api/billing/subscribe — assina um plano SaaS.
//   cycle=monthly  → assinatura recorrente (cobrança todo mês no cartão).
//   cycle=annual   → pagamento único no cartão, parcelável em até 12x.
// Retorna checkoutUrl: o pagador insere o cartão numa página hospedada pelo
// gateway — o backend nunca processa dados de cartão diretamente.
billingRouter.post('/subscribe', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const p = subscribeSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'validation', message: p.error.issues[0]?.message });
  const { plan_id, cycle, installments } = p.data;

  if (!isAsaasConfigured) {
    return res.status(503).json({
      code: 'billing_not_configured',
      message: 'Pagamento ainda não está configurado. Fale com o suporte para ativar sua assinatura.',
    });
  }

  try {
    const result = await withTenant(req.ctx!, async (c) => {
      const planRow = await c.query(
        `select id, name, monthly_price::float8 as monthly_price, annual_price::float8 as annual_price
           from public.plans where id=$1 and is_public=true`,
        [plan_id],
      );
      if (planRow.rows.length === 0) {
        throw Object.assign(new Error('Plano não encontrado'), { http: 404, code: 'plan_not_found' });
      }
      const plan = planRow.rows[0];

      const schoolRow = await c.query(
        `select id, name, cnpj, email, phone, asaas_billing_customer_id
           from public.schools where id=$1`,
        [req.ctx!.schoolId],
      );
      const school = schoolRow.rows[0];
      if (!school?.cnpj) {
        throw Object.assign(
          new Error('Cadastre o CNPJ da escola em Configurações antes de assinar um plano.'),
          { http: 400, code: 'missing_cnpj' },
        );
      }

      const customerId = await asaasEnsureBillingCustomer({
        existingCustomerId: school.asaas_billing_customer_id,
        name: school.name,
        cpfCnpj: school.cnpj,
        email: school.email ?? undefined,
        phone: school.phone ?? undefined,
      });
      if (!school.asaas_billing_customer_id) {
        await c.query(`update public.schools set asaas_billing_customer_id=$1 where id=$2`, [customerId, req.ctx!.schoolId]);
      }

      let checkoutUrl: string | undefined;
      let amount: number;

      if (cycle === 'monthly') {
        amount = plan.monthly_price;
        const sub = await asaasCreateSubscription({
          customerId,
          value: amount,
          description: `Assinatura GestEscolar — ${plan.name} (mensal)`,
          externalReference: `subscription:${req.ctx!.schoolId}:${plan.id}:monthly`,
        });
        checkoutUrl = sub.checkoutUrl;
      } else {
        amount = plan.annual_price;
        const installmentCount = installments ?? 1;
        const charge = await asaasCreateInstallmentCharge({
          customerId,
          totalValue: amount,
          installmentCount,
          description: `Assinatura GestEscolar — ${plan.name} (anual${installmentCount > 1 ? ` em ${installmentCount}x` : ''})`,
          externalReference: `subscription:${req.ctx!.schoolId}:${plan.id}:annual`,
        });
        checkoutUrl = charge.checkoutUrl;
      }

      await c.query(
        `insert into public.subscriptions (school_id, plan_id, status, billing_cycle, amount, installment_count, checkout_url)
         values ($1,$2,'pending_payment',$3,$4,$5,$6)`,
        [req.ctx!.schoolId, plan.id, cycle, amount, installments ?? null, checkoutUrl ?? null],
      );

      return { checkoutUrl };
    });

    if (!result.checkoutUrl) {
      return res.status(502).json({ code: 'checkout_unavailable', message: 'Não foi possível gerar o link de pagamento. Tente novamente.' });
    }
    res.json({ ok: true, data: { checkoutUrl: result.checkoutUrl } });
  } catch (err: any) {
    console.error('[billing.subscribe] erro:', err?.message ?? err);
    res.status(err?.http ?? 500).json({ code: err?.code ?? 'subscribe_failed', message: err?.message ?? 'Falha ao iniciar assinatura' });
  }
});
