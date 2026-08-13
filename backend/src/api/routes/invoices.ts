import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { withTenant } from '../../db/withTenant';
import { buildChargeForInvoice, getPaymentProvider, type BillingType } from '../../lib/payments';
import { notifyChargeCreated } from '../../lib/email';
import { audit } from '../../lib/audit';

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/invoices/diagnostics
// Lista anomalias de integridade das faturas:
//   1. legacy_no_snapshot  — faturas sem plan_id/plan_snapshot (emitidas antes da migration 0024)
//   2. math_mismatch       — amount ≠ round(original_amount × (1 - discount_pct/100), 2)
//   3. plan_fee_drift      — snapshot.monthly_fee diverge do plano atual (informa; não corrige)
// Nunca modifica dados. Exige confirmação explícita para qualquer correção.
// ---------------------------------------------------------------------------
invoicesRouter.get('/diagnostics', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const sid = req.ctx!.schoolId;

    // 1. Faturas sem snapshot (legadas ou geradas antes desta feature)
    const { rows: legacy } = await c.query(
      `select id, student_name, amount::float8 as amount, kind, reference_month,
              to_char(due_date,'YYYY-MM-DD') as due_date, status
         from public.invoices
        where school_id=$1
          and kind in ('mensalidade','matricula')
          and plan_id is null
          and status not in ('cancelled','refunded')
        order by due_date desc nulls last
        limit 500`,
      [sid],
    );

    // 2. Inconsistência matemática: amount ≠ original_amount × fator de desconto
    const { rows: mathMismatch } = await c.query(
      `select id, student_name, amount::float8 as amount,
              original_amount::float8 as original_amount,
              discount_pct::float8 as discount_pct,
              round(original_amount * (1 - discount_pct/100), 2)::float8 as expected_amount,
              kind, reference_month, to_char(due_date,'YYYY-MM-DD') as due_date, status
         from public.invoices
        where school_id=$1
          and plan_id is not null
          and original_amount is not null
          and abs(amount - round(original_amount * (1 - discount_pct/100), 2)) > 0.009
          and status not in ('cancelled','refunded')
        order by due_date desc nulls last`,
      [sid],
    );

    // 3. Deriva de plano: valor no snapshot ≠ valor atual do plano (somente informativo)
    const { rows: planDrift } = await c.query(
      `select i.id, i.student_name, i.amount::float8 as amount,
              i.original_amount::float8 as original_amount,
              (i.plan_snapshot->>'monthly_fee')::float8 as snapshot_monthly_fee,
              sp.monthly_fee::float8 as current_plan_fee,
              i.kind, i.reference_month, to_char(i.due_date,'YYYY-MM-DD') as due_date, i.status,
              i.plan_id::text as plan_id
         from public.invoices i
         join public.school_plans sp on sp.id = i.plan_id
        where i.school_id=$1
          and i.kind = 'mensalidade'
          and i.plan_snapshot is not null
          and abs((i.plan_snapshot->>'monthly_fee')::numeric - sp.monthly_fee) > 0.009
          and i.status not in ('cancelled','refunded')
        order by i.due_date desc nulls last
        limit 500`,
      [sid],
    );

    const allIds = new Set<string>([
      ...legacy.map((r: any) => r.id),
      ...mathMismatch.map((r: any) => r.id),
      ...planDrift.map((r: any) => r.id),
    ]);

    return {
      summary: {
        legacy_no_snapshot: legacy.length,
        math_mismatch: mathMismatch.length,
        plan_fee_drift: planDrift.length,
        total_distinct_anomalies: allIds.size,
      },
      legacy_no_snapshot: legacy,
      math_mismatch: mathMismatch,
      plan_fee_drift: planDrift,
    };
  });
  res.json({ ok: true, data });
});

// ---------------------------------------------------------------------------
// POST /api/invoices/correct-bulk
// Corrige o campo `amount` de faturas com inconsistência matemática
// (amount ≠ round(original_amount × fator_desconto, 2)).
// Exige `confirm: true` no body — sem confirmação retorna 400 imediatamente.
// Não toca em faturas legadas (sem original_amount) nem em pagas/canceladas.
// Cada correção gera registro em audit_logs.
// ---------------------------------------------------------------------------
const correctBulkSchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1).max(500),
  reason: z.string().min(3, 'Informe o motivo da correção (mínimo 3 caracteres)'),
  confirm: z.literal(true, { errorMap: () => ({ message: 'Confirme a operação enviando confirm: true' }) }),
});

invoicesRouter.post('/correct-bulk', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const p = correctBulkSchema.safeParse(req.body);
  if (!p.success) {
    return res.status(400).json({ code: 'confirmation_required', message: p.error.issues[0]?.message });
  }
  const { invoice_ids, reason } = p.data;

  const results = await withTenant(req.ctx!, async (c) => {
    const corrected: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const id of invoice_ids) {
      const { rows } = await c.query(
        `select id, status, amount::float8 as amount,
                original_amount::float8 as original_amount,
                discount_pct::float8 as discount_pct
           from public.invoices where id=$1 and school_id=$2 limit 1`,
        [id, req.ctx!.schoolId],
      );
      if (!rows[0]) { skipped.push({ id, reason: 'não encontrada ou pertence a outra escola' }); continue; }
      const row = rows[0];
      if (['paid', 'cancelled', 'refunded'].includes(row.status)) {
        skipped.push({ id, reason: `status=${row.status} — não corrigível` }); continue;
      }
      if (row.original_amount == null) {
        skipped.push({ id, reason: 'fatura legada sem snapshot — impossível corrigir automaticamente' }); continue;
      }

      const expected = Math.round(Number(row.original_amount) * (1 - Number(row.discount_pct) / 100) * 100) / 100;
      if (Math.abs(expected - Number(row.amount)) <= 0.009) {
        skipped.push({ id, reason: 'valor já está correto' }); continue;
      }

      await c.query(
        `update public.invoices set amount=$2, updated_at=now() where id=$1`,
        [id, expected],
      );
      await c.query(
        `insert into public.audit_logs (school_id, user_id, action, entity_type, entity_id, metadata)
         values ($1,$2,'INVOICE_BULK_CORRECT','invoice',$3,$4)`,
        [req.ctx!.schoolId, req.ctx!.profileId, id,
         JSON.stringify({ old_amount: row.amount, new_amount: expected, reason, confirmed: true })],
      );
      corrected.push(id);
    }
    return { corrected_count: corrected.length, skipped_count: skipped.length, corrected, skipped };
  });

  res.json({ ok: true, data: results });
});

// GET /api/invoices — faturas da escola (gestão/financeiro)
invoicesRouter.get('/', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select i.id, i.student_name, i.amount::float8 as amount, i.due_date, i.status, i.payment_method,
              i.kind, i.reference_month, i.checkout_url, i.paid_at, i.created_at,
              g.name as guardian_name, cl.name as class_name,
              st.registration_number as registration_number
         from public.invoices i
         left join public.students st on st.id = i.student_id
         left join public.guardians g on g.id = st.guardian_id
         left join public.classes cl on cl.id = st.class_id
        where i.school_id = $1
        order by i.due_date desc nulls last`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// GET /api/invoices/mine — faturas do(s) aluno(s) do responsável autenticado.
invoicesRouter.get('/mine', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const guardian = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [req.ctx!.profileId]);
    if (guardian.rows.length === 0) return [];
    const { rows } = await c.query(
      `select i.id, i.student_name, i.amount::float8 as amount, i.due_date, i.status, i.kind,
              i.reference_month, i.pix_qr_code, i.pix_copy_paste, i.checkout_url, i.paid_at,
              i.payment_method, i.billing_type, i.created_at,
              i.guardian_response, i.guardian_response_note, i.guardian_response_at,
              b.title as charge_title, b.description as charge_description
         from public.invoices i
         join public.students s on s.id = i.student_id
         left join public.charge_batches b on b.id = i.batch_id
        where s.guardian_id = $1 and i.school_id = $2
        order by i.due_date asc nulls last`,
      [guardian.rows[0].id, req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});

// POST /api/invoices/:id/guardian-response — resposta do responsável a uma
// cobrança avulsa: "decline" (não vai participar → cancela a fatura) ou
// "dispute" (quer mais informações → mantém pendente e sinaliza para gestão).
// Só funciona em faturas kind='avulsa' status='pending' pertencentes a um
// aluno do responsável autenticado.
invoicesRouter.post('/:id/guardian-response', async (req, res) => {
  const action = req.body?.action;
  const note = typeof req.body?.note === 'string' ? String(req.body.note).slice(0, 500) : null;
  if (action !== 'decline' && action !== 'dispute') {
    return res.status(400).json({ code: 'validation', message: 'Ação inválida.' });
  }
  const result = await withTenant(req.ctx!, async (c) => {
    const g = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [req.ctx!.profileId]);
    if (g.rows.length === 0) return { error: 'not_guardian' as const };
    const guardianId = g.rows[0].id;

    // Verifica dono + tipo/status antes de atualizar. Faz o filtro por
    // guardian_id no WHERE — sem isso, um responsável poderia responder à
    // fatura avulsa de outro aluno passando o id direto.
    const inv = await c.query(
      `select i.id, i.status, i.kind, i.student_name, b.title as charge_title
         from public.invoices i
         join public.students s on s.id = i.student_id
         left join public.charge_batches b on b.id = i.batch_id
        where i.id=$1 and i.school_id=$2 and s.guardian_id=$3 limit 1`,
      [req.params.id, req.ctx!.schoolId, guardianId],
    );
    if (inv.rows.length === 0) return { error: 'not_found' as const };
    const row = inv.rows[0];
    if (row.kind !== 'avulsa') return { error: 'not_avulsa' as const };
    if (row.status !== 'pending') return { error: 'not_pending' as const };

    const responseValue = action === 'decline' ? 'declined' : 'disputed';
    // Não participar → cancela a fatura de fato. Contestar → mantém pendente.
    const newStatus = action === 'decline' ? 'cancelled' : row.status;

    await c.query(
      `update public.invoices set
          guardian_response=$1,
          guardian_response_note=$2,
          guardian_response_at=now(),
          status=$3
        where id=$4`,
      [responseValue, note, newStatus, row.id],
    );
    await audit(c, {
      schoolId: req.ctx!.schoolId!, userId: req.ctx!.profileId,
      action: action === 'decline' ? 'INVOICE_DECLINED_BY_GUARDIAN' : 'INVOICE_DISPUTED_BY_GUARDIAN',
      entityType: 'invoice', entityId: row.id,
      metadata: { title: row.charge_title, student: row.student_name, note },
    });
    return { ok: true as const };
  });
  if ('error' in result) {
    const map: Record<string, { http: number; msg: string }> = {
      not_guardian: { http: 403, msg: 'Apenas responsáveis podem responder cobranças.' },
      not_found:    { http: 404, msg: 'Cobrança não encontrada.' },
      not_avulsa:   { http: 400, msg: 'Apenas cobranças avulsas podem ser recusadas ou contestadas.' },
      not_pending:  { http: 400, msg: 'Esta cobrança não está mais em aberto.' },
    };
    const m = map[result.error];
    return res.status(m.http).json({ code: result.error, message: m.msg });
  }
  res.json({ ok: true });
});

// POST /api/invoices/:id/card-checkout — garante que a fatura do responsável
// aceite o método escolhido pelo RESPONSÁVEL — PIX ou cartão de crédito.
//
// Só esses dois, nunca boleto: por isso o billingType é fixado em vez de usar
// o 'UNDEFINED' do ASAAS, onde os métodos exibidos dependem da configuração da
// conta e o boleto entraria junto.
//
// O preço de fixar é que a cobrança tem um método só, então alternar recria a
// cobrança. Ao recriar é obrigatório cancelar a anterior: buildChargeForInvoice
// sempre cria uma cobrança NOVA no provedor, e sem o cancelamento a fatura
// ficaria com duas cobranças pagáveis — o responsável poderia pagar duas vezes.
//
// Os dados do cartão são digitados NA PÁGINA DO PROVEDOR, nunca em tela
// nossa: o sistema não deve tocar em número de cartão (escopo PCI).
invoicesRouter.post('/:id/card-checkout', async (req, res) => {
  const target: BillingType = req.body?.billingType === 'PIX' ? 'PIX' : 'CREDIT_CARD';

  const outcome = await withTenant(req.ctx!, async (c) => {
    const g = await c.query(`select id from public.guardians where user_id=$1 limit 1`, [req.ctx!.profileId]);
    if (g.rows.length === 0) return { error: 'not_guardian' as const };

    // Filtro por guardian_id no WHERE: sem ele, um responsável trocaria a
    // forma de pagamento da fatura de outro aluno passando o id direto.
    const inv = await c.query(
      `select i.id, i.status, i.billing_type, i.checkout_url, i.pix_copy_paste, i.nuvende_charge_id
         from public.invoices i
         join public.students s on s.id = i.student_id
        where i.id=$1 and i.school_id=$2 and s.guardian_id=$3 limit 1`,
      [req.params.id, req.ctx!.schoolId, g.rows[0].id],
    );
    if (inv.rows.length === 0) return { error: 'not_found' as const };
    const row = inv.rows[0];
    if (row.status === 'paid') return { error: 'already_paid' as const };
    if (row.status !== 'pending') return { error: 'not_pending' as const };

    // Já está no método pedido e utilizável → não recria nada. Evita cancelar
    // e gerar cobrança nova a cada clique (e trocar o código PIX à toa).
    const usable = target === 'CREDIT_CARD' ? row.checkout_url : row.pix_copy_paste;
    if (row.billing_type === target && usable) {
      return {
        data: {
          billing_type: target,
          checkout_url: row.checkout_url ?? null,
          pix_copy_paste: row.pix_copy_paste ?? null,
          pix_qr_code: null as string | null,
        },
      };
    }

    if (row.nuvende_charge_id) {
      await getPaymentProvider().cancelCharge(String(row.nuvende_charge_id));
    }

    const r = await buildChargeForInvoice(c, req.ctx!.schoolId!, req.params.id, target);
    if ('error' in r) return r;
    if (target === 'CREDIT_CARD' && !r.charge.invoiceUrl) return { error: 'no_checkout_url' as const };

    await audit(c, {
      schoolId: req.ctx!.schoolId!, userId: req.ctx!.profileId,
      action: 'INVOICE_BILLING_TYPE_CHANGED', entityType: 'invoice', entityId: req.params.id,
      metadata: { from: row.billing_type ?? null, to: target, by: 'guardian' },
    });
    return {
      data: {
        billing_type: target,
        checkout_url: r.charge.invoiceUrl ?? null,
        pix_copy_paste: r.charge.pixCopyPaste ?? null,
        pix_qr_code: r.charge.pixQrCode ?? null,
      },
    };
  });

  if ('error' in outcome) {
    const map: Record<string, [number, string]> = {
      not_guardian:     [403, 'Apenas responsáveis podem alterar a forma de pagamento.'],
      not_found:        [404, 'Cobrança não encontrada.'],
      already_paid:     [409, 'Esta cobrança já foi paga.'],
      not_pending:      [409, 'Esta cobrança não está mais em aberto.'],
      payout_not_ready: [409, 'A escola ainda não concluiu o cadastro da conta de recebimento.'],
      no_checkout_url:  [502, 'O provedor não retornou o link de pagamento. Tente novamente.'],
    };
    const [http, message] = map[String(outcome.error)] ?? [400, 'Não foi possível gerar o pagamento no cartão.'];
    return res.status(http).json({ code: outcome.error, message });
  }
  res.json({ ok: true, data: outcome.data });
});

// POST /api/invoices/:id/pix — gera/renova a cobrança PIX da fatura
invoicesRouter.post('/:id/pix', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const result = await withTenant(req.ctx!, async (c) => {
    const r = await buildChargeForInvoice(c, req.ctx!.schoolId!, req.params.id, 'PIX');
    if ('error' in r) return r;
    // Dados para notificar o responsável por e-mail (fora da transação).
    const info = await c.query(
      `select i.student_name, i.amount::float8 as amount, i.due_date, i.kind,
              g.email as guardian_email, b.title as charge_title, sc.name as school_name
         from public.invoices i
         left join public.students st on st.id = i.student_id
         left join public.guardians g on g.id = st.guardian_id
         left join public.charge_batches b on b.id = i.batch_id
         left join public.schools sc on sc.id = i.school_id
        where i.id=$1 and i.school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
    await audit(c, {
      schoolId: req.ctx!.schoolId!, userId: req.ctx!.profileId, action: 'INVOICE_PIX_GENERATED',
      entityType: 'invoice', entityId: req.params.id,
    });
    return { charge: r.charge, info: info.rows[0] as any };
  });
  if ('error' in result) {
    if (result.error === 'payout_not_ready') {
      return res.status(409).json({ code: 'payout_not_ready', message: 'Envie os documentos da conta de recebimento antes de gerar cobranças PIX.' });
    }
    return res.status(result.error === 'not_found' ? 404 : 409).json({ code: result.error, message: result.error });
  }

  // Notificação por e-mail — fire-and-forget: nunca bloqueia nem quebra a resposta.
  const info = result.info;
  if (info?.guardian_email) {
    notifyChargeCreated(info.guardian_email, {
      studentName: info.student_name,
      amount: Number(info.amount),
      dueDate: info.due_date instanceof Date ? info.due_date.toISOString().slice(0, 10) : info.due_date,
      description: info.kind === 'avulsa' ? (info.charge_title ?? 'Cobrança avulsa') : 'Mensalidade',
      schoolName: info.school_name,
    }).catch((e) => console.error('[invoices.pix] notificação de e-mail falhou:', e?.message ?? e));
  }

  res.json({ ok: true, data: result.charge });
});

// POST /api/invoices/:id/send-to-guardian — gera PIX (se ainda não tem) e envia o
// código copia-e-cola ao responsável por mensagem interna (chat). Se a fatura já
// tem PIX gerado, reaproveita o pix_copy_paste persistido. Requer que a escola
// tenha subconta ASAAS habilitada (mesma checagem de buildChargeForInvoice).
invoicesRouter.post('/:id/send-to-guardian', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const outcome = await withTenant(req.ctx!, async (c) => {
    // Se ainda não temos o copia-e-cola, gera a cobrança PIX antes.
    const cur = await c.query(
      `select pix_copy_paste, student_name, student_id, amount::float8 as amount, due_date, kind
         from public.invoices where id=$1 and school_id=$2`,
      [req.params.id, req.ctx!.schoolId],
    );
    if (cur.rows.length === 0) return { error: 'not_found' as const };
    let copyPaste: string | null = cur.rows[0].pix_copy_paste ?? null;
    const invRow = cur.rows[0];

    if (!copyPaste) {
      const r = await buildChargeForInvoice(c, req.ctx!.schoolId!, req.params.id, 'PIX');
      if ('error' in r) return { error: r.error };
      copyPaste = r.charge.pixCopyPaste ?? null;
    }
    if (!copyPaste) return { error: 'no_copy_paste' as const };

    // Descobre o profile do responsável (guardian.user_id) para postar a mensagem.
    const g = await c.query(
      `select g.user_id
         from public.students st
         join public.guardians g on g.id = st.guardian_id
        where st.id = $1 and st.school_id = $2`,
      [invRow.student_id, req.ctx!.schoolId],
    );
    const guardianProfileId = g.rows[0]?.user_id as string | null;
    if (!guardianProfileId) return { error: 'guardian_without_login' as const };

    const dueLabel = invRow.due_date
      ? new Date(invRow.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      : '—';
    const amountLabel = Number(invRow.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const kindLabel = invRow.kind === 'avulsa' ? 'Cobrança avulsa' : 'Mensalidade';
    const body =
      `${kindLabel} — ${invRow.student_name}\n` +
      `Valor: ${amountLabel}\n` +
      `Vencimento: ${dueLabel}\n\n` +
      `Copie o código PIX abaixo e cole no app do seu banco:\n\n` +
      `${copyPaste}\n`;

    await c.query(
      `insert into public.messages (school_id, sender_id, recipient_id, student_id, subject, body)
       values ($1,$2,$3,$4,$5,$6)`,
      [req.ctx!.schoolId, req.ctx!.profileId, guardianProfileId, invRow.student_id,
       `Cobrança PIX — ${invRow.student_name}`, body],
    );
    await audit(c, {
      schoolId: req.ctx!.schoolId!, userId: req.ctx!.profileId, action: 'INVOICE_SENT_TO_GUARDIAN',
      entityType: 'invoice', entityId: req.params.id,
    });

    return { data: { sent_to: guardianProfileId, copy_paste: copyPaste } };
  });

  if ('error' in outcome) {
    const map: Record<string, [number, string]> = {
      not_found: [404, 'Fatura não encontrada.'],
      already_paid: [409, 'Esta fatura já está paga.'],
      payout_not_ready: [409, 'Envie os documentos da conta de recebimento antes de gerar cobranças.'],
      guardian_without_login: [409, 'Este responsável ainda não tem acesso ao portal para receber mensagens.'],
      no_copy_paste: [502, 'Não foi possível obter o código PIX do provedor. Tente novamente.'],
    };
    const [http, message] = map[String(outcome.error)] ?? [400, 'Não foi possível enviar a cobrança ao responsável.'];
    return res.status(http).json({ code: outcome.error, message });
  }
  res.json({ ok: true, data: outcome.data });
});

// POST /api/invoices/:id/charge — cobrança PIX ou cartão de crédito
invoicesRouter.post('/:id/charge', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const billingType: BillingType = req.body?.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';
  const result = await withTenant(req.ctx!, async (c) => {
    const r = await buildChargeForInvoice(c, req.ctx!.schoolId!, req.params.id, billingType);
    if (!('error' in r)) {
      await audit(c, {
        schoolId: req.ctx!.schoolId!, userId: req.ctx!.profileId, action: 'INVOICE_CHARGED',
        entityType: 'invoice', entityId: req.params.id, metadata: { billingType },
      });
    }
    return r;
  });
  if ('error' in result) {
    if (result.error === 'payout_not_ready') {
      return res.status(409).json({ code: 'payout_not_ready', message: 'Envie os documentos da conta de recebimento antes de gerar cobranças.' });
    }
    return res.status(result.error === 'not_found' ? 404 : 409).json({ code: result.error, message: result.error });
  }
  res.json({ ok: true, data: result.charge });
});

// POST /api/invoices/:id/manual-payment — registra pagamento recebido OFFLINE
// (dinheiro/na escola). NÃO passou pelo gateway → NÃO entra no saldo sacável
// (available_balance), pois a plataforma não recebeu esse valor. Apenas marca a
// fatura como paga e registra auditoria. Mesmo padrão da matrícula paga em cash.
invoicesRouter.post('/:id/manual-payment', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const method = req.body?.payment_method;
  const allowed = ['cash', 'pix', 'card', 'other'];
  const payMethod = allowed.includes(method) ? method : 'cash';
  // Data do pagamento: hoje por padrão; aceita YYYY-MM-DD (não pode ser futura).
  const rawDate = typeof req.body?.paid_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.paid_at)
    ? req.body.paid_at : null;

  const result = await withTenant(req.ctx!, async (c) => {
    const inv = await c.query(
      `select id, status from public.invoices where id=$1 and school_id=$2 limit 1`,
      [req.params.id, req.ctx!.schoolId],
    );
    if (inv.rows.length === 0) return { error: 'not_found' as const };
    const status = inv.rows[0].status;
    if (status === 'paid') return { error: 'already_paid' as const };
    if (status === 'cancelled' || status === 'refunded') return { error: 'not_payable' as const };

    const { rows } = await c.query(
      `update public.invoices
          set status='paid',
              payment_method=$3,
              paid_at = coalesce($4::timestamptz, now()),
              updated_at = now()
        where id=$1 and school_id=$2
        returning id, status, amount::float8 as amount, paid_at, payment_method`,
      [req.params.id, req.ctx!.schoolId, payMethod, rawDate ? `${rawDate}T12:00:00` : null],
    );

    await c.query(
      `insert into public.audit_logs (school_id, user_id, action, entity_type, entity_id, metadata)
       values ($1,$2,'PAYMENT_MANUAL','invoice',$3,$4)`,
      [req.ctx!.schoolId, req.ctx!.profileId, req.params.id,
       JSON.stringify({ payment_method: payMethod, paid_at: rawDate ?? 'now', offline: true })],
    );
    return { data: rows[0] };
  });

  if ('error' in result) {
    const map: Record<string, [number, string]> = {
      not_found: [404, 'Fatura não encontrada.'],
      already_paid: [409, 'Esta fatura já está paga.'],
      not_payable: [409, 'Fatura cancelada/estornada não pode ser baixada.'],
    };
    const [http, message] = map[String(result.error)] ?? [400, 'Não foi possível registrar o pagamento.'];
    return res.status(http).json({ code: result.error, message });
  }
  res.json({ ok: true, data: result.data });
});

// GET /api/finance/balance — saldo da escola
invoicesRouter.get('/balance/summary', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const { rows } = await c.query(
      `select available_balance::float8 as available_balance,
              pending_balance::float8 as pending_balance,
              gross_received_total::float8 as gross_received_total,
              platform_fees_total::float8 as platform_fees_total,
              provider_fees_total::float8 as provider_fees_total,
              withdrawn_total::float8 as withdrawn_total
         from public.school_balances where school_id = $1`,
      [req.ctx!.schoolId],
    );
    return rows[0] ?? {
      available_balance: 0, pending_balance: 0, gross_received_total: 0,
      platform_fees_total: 0, provider_fees_total: 0, withdrawn_total: 0,
    };
  });
  res.json({ ok: true, data });
});
