// =============================================================
//  Pagamento recorrente no cartão, cadastrado pelo RESPONSÁVEL.
//
//  O cartão nunca passa por aqui: criamos a assinatura no ASAAS e
//  devolvemos o link do checkout hospedado, onde o responsável digita os
//  dados. Guardamos apenas o id da assinatura — o sistema fica fora do
//  escopo PCI-DSS.
//
//  Uma recorrência por ALUNO: a mensalidade é do aluno, e um responsável
//  com dois filhos pode querer automatizar só um.
// =============================================================
import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import {
  isAsaasConfigured, asaasCreateSubscription, asaasCancelSubscription, asaasEnsureBillingCustomer,
} from '../../lib/payments';
import { calculatePixSplit } from '../../lib/fees';
import { audit } from '../../lib/audit';

export const recurringRouter = Router();

/** Resolve o guardian do usuário autenticado. */
async function guardianOf(c: any, profileId: string): Promise<string | null> {
  const g = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [profileId]);
  return g.rows[0]?.id ?? null;
}

// GET /api/recurring — filhos do responsável + estado da recorrência de cada um.
recurringRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const guardianId = await guardianOf(c, req.ctx!.profileId);
    if (!guardianId) return [];
    const { rows } = await c.query(
      `select s.id as student_id, s.name as student_name,
              p.monthly_fee::float8 as monthly_fee,
              r.id as recurring_id, r.status, r.last_error, r.last_charged_at,
              r.amount::float8 as amount
         from public.students s
         left join public.school_plans p on p.id = s.plan_id
         left join public.guardian_recurring_payments r on r.student_id = s.id
        where s.guardian_id=$1 and s.school_id=$2 and s.status='active'
        order by s.name`,
      [guardianId, req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// POST /api/recurring/:studentId — liga o pagamento automático do aluno.
// Devolve o checkout do provedor para o responsável cadastrar o cartão.
recurringRouter.post('/:studentId', async (req, res) => {
  if (!isAsaasConfigured) {
    return res.status(503).json({ code: 'provider_unavailable', message: 'Pagamento automático indisponível no momento.' });
  }

  const outcome = await withTenant(req.ctx!, async (c) => {
    const guardianId = await guardianOf(c, req.ctx!.profileId);
    if (!guardianId) return { error: 'not_guardian' as const };

    // Filtro por guardian_id: sem ele, daria para ligar recorrência no aluno
    // de outra família passando o id direto.
    const st = await c.query(
      `select s.id, s.name, p.monthly_fee::float8 as monthly_fee,
              g.name as guardian_name, g.cpf, g.email, g.phone, g.asaas_customer_id,
              sc.asaas_wallet_id
         from public.students s
         join public.guardians g on g.id = s.guardian_id
         join public.schools sc on sc.id = s.school_id
         left join public.school_plans p on p.id = s.plan_id
        where s.id=$1 and s.school_id=$2 and s.guardian_id=$3 and s.status='active'
        limit 1`,
      [req.params.studentId, req.ctx!.schoolId, guardianId],
    );
    if (st.rows.length === 0) return { error: 'not_found' as const };
    const s = st.rows[0];

    const amount = Number(s.monthly_fee ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'no_plan' as const };
    if (!s.asaas_wallet_id) return { error: 'payout_not_ready' as const };
    if (!s.cpf) return { error: 'guardian_without_cpf' as const };

    const existing = await c.query(
      `select id, status, provider_subscription_id
         from public.guardian_recurring_payments where student_id=$1 limit 1`,
      [req.params.studentId],
    );
    if (existing.rows[0]?.status === 'active') return { error: 'already_active' as const };

    // Assinatura anterior cancelada/falha: derruba no provedor antes de criar
    // outra, senão o cartão seguiria sendo cobrado pela assinatura órfã.
    const prev = existing.rows[0]?.provider_subscription_id;
    if (prev) await asaasCancelSubscription(String(prev));

    // O responsável pode ainda não ter cliente no ASAAS (só é criado na 1ª
    // cobrança). Sem isso a assinatura falharia por falta de pagador.
    const customerId = await asaasEnsureBillingCustomer({
      existingCustomerId: s.asaas_customer_id,
      name: String(s.guardian_name ?? ''),
      cpfCnpj: String(s.cpf),
      email: s.email ?? undefined,
      phone: s.phone ?? undefined,
    });
    if (customerId !== s.asaas_customer_id) {
      await c.query(`update public.guardians set asaas_customer_id=$1 where id=$2`, [customerId, guardianId]);
    }

    const split = calculatePixSplit(amount);
    const sub = await asaasCreateSubscription({
      customerId,
      value: amount,
      description: `Mensalidade — ${s.name}`,
      externalReference: `recurring:${req.ctx!.schoolId}:${s.id}`,
      split: [{ walletId: String(s.asaas_wallet_id), fixedValue: split.schoolNetAmount }],
    });

    await c.query(
      `insert into public.guardian_recurring_payments
         (school_id, guardian_id, student_id, provider_subscription_id, status, amount)
       values ($1,$2,$3,$4,'pending',$5)
       on conflict (student_id) do update
         set provider_subscription_id = excluded.provider_subscription_id,
             status='pending', amount=excluded.amount, last_error=null, updated_at=now()`,
      [req.ctx!.schoolId, guardianId, s.id, sub.subscriptionId, amount],
    );

    await audit(c, {
      schoolId: req.ctx!.schoolId!, userId: req.ctx!.profileId,
      action: 'RECURRING_PAYMENT_ENABLED', entityType: 'student', entityId: String(s.id),
      metadata: { amount, subscription: sub.subscriptionId },
    });

    return { data: { checkout_url: sub.checkoutUrl ?? null, amount } };
  });

  if ('error' in outcome) {
    const map: Record<string, [number, string]> = {
      not_guardian:         [403, 'Apenas responsáveis podem cadastrar pagamento automático.'],
      not_found:            [404, 'Aluno não encontrado.'],
      no_plan:              [409, 'Este aluno não tem um plano de mensalidade definido. Fale com a escola.'],
      payout_not_ready:     [409, 'A escola ainda não concluiu o cadastro da conta de recebimento.'],
      guardian_without_cpf: [409, 'Cadastre seu CPF antes de ativar o pagamento automático.'],
      already_active:       [409, 'O pagamento automático já está ativo para este aluno.'],
    };
    const [http, message] = map[String(outcome.error)] ?? [400, 'Não foi possível ativar o pagamento automático.'];
    return res.status(http).json({ code: outcome.error, message });
  }
  res.json({ ok: true, data: outcome.data });
});

// DELETE /api/recurring/:studentId — desliga o pagamento automático.
recurringRouter.delete('/:studentId', async (req, res) => {
  const outcome = await withTenant(req.ctx!, async (c) => {
    const guardianId = await guardianOf(c, req.ctx!.profileId);
    if (!guardianId) return { error: 'not_guardian' as const };

    const r = await c.query(
      `select id, provider_subscription_id from public.guardian_recurring_payments
        where student_id=$1 and guardian_id=$2 and school_id=$3 limit 1`,
      [req.params.studentId, guardianId, req.ctx!.schoolId],
    );
    if (r.rows.length === 0) return { error: 'not_found' as const };

    // Cancela no provedor ANTES de marcar no banco: se a chamada falhar, o
    // registro continua ativo e o responsável pode tentar de novo — o pior
    // caso seria marcar como cancelado aqui e o cartão seguir sendo cobrado.
    if (r.rows[0].provider_subscription_id) {
      await asaasCancelSubscription(String(r.rows[0].provider_subscription_id));
    }
    await c.query(
      `update public.guardian_recurring_payments
          set status='cancelled', updated_at=now() where id=$1`,
      [r.rows[0].id],
    );
    await audit(c, {
      schoolId: req.ctx!.schoolId!, userId: req.ctx!.profileId,
      action: 'RECURRING_PAYMENT_CANCELLED', entityType: 'student', entityId: String(req.params.studentId),
    });
    return { data: { ok: true } };
  });

  if ('error' in outcome) {
    const map: Record<string, [number, string]> = {
      not_guardian: [403, 'Apenas responsáveis podem alterar o pagamento automático.'],
      not_found:    [404, 'Não há pagamento automático cadastrado para este aluno.'],
    };
    const [http, message] = map[String(outcome.error)] ?? [400, 'Não foi possível cancelar.'];
    return res.status(http).json({ code: outcome.error, message });
  }
  res.json({ ok: true });
});
