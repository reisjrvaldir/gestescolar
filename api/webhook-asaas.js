// =============================================
//  GESTESCOLAR – WEBHOOK ASAAS
//  Recebe notificações de pagamento do Asaas
//  Atualiza status no Supabase automaticamente
// =============================================

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

module.exports = async function handler(req, res) {
  // Anti-cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');

  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Validar configuração
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !WEBHOOK_TOKEN) {
    console.error('[Webhook] Configuração incompleta:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_SERVICE_KEY: !!SUPABASE_SERVICE_KEY, WEBHOOK_TOKEN: !!WEBHOOK_TOKEN });
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  // Validar token do webhook — aceitar APENAS via header (asaas-access-token).
  // Query param foi removido: vazava o token nos logs do Vercel, no Referer
  // header e em qualquer proxy intermediário. O Asaas envia via header por
  // padrão (documentação oficial), então não há regressão funcional.
  const token = req.headers['asaas-access-token'];
  if (!token || token !== WEBHOOK_TOKEN) {
    return res.status(403).json({ error: 'Token inválido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { event, payment, account, subscription } = body;

    console.log(`[Webhook Asaas] Evento: ${event}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const VERCEL_URL = process.env.VERCEL_URL || 'https://gestescolar.app';

    // ═══════════════════════════════════════════════════════════════════
    //  EVENTOS DE ASSINATURA RECORRENTE (cartão mensal)
    //  Quando o cartão falha múltiplas vezes, o Asaas inativa a subscription
    //  e dispara SUBSCRIPTION_INACTIVATED. Sem tratar isso, a escola fica
    //  liberada para sempre (planExpiresAt:null + planSubscriptionId definido
    //  isenta o bloqueio por padrão).
    // ═══════════════════════════════════════════════════════════════════
    if (event && event.startsWith('SUBSCRIPTION_')) {
      const subId = subscription?.id || body?.id;
      const subExtRef = subscription?.externalReference || '';

      if (!subId && !subExtRef) {
        return res.status(200).json({ received: true, message: 'Sem dados de assinatura.' });
      }

      // Localizar escola pelo plan_subscription_id OU pelo externalReference (schoolId|planId|billing)
      let targetSchoolId = null;
      if (subExtRef) {
        const m = subExtRef.match(/^([0-9a-fA-F-]{36})\|/);
        if (m) targetSchoolId = m[1];
      }
      if (!targetSchoolId && subId) {
        const { data: schs } = await supabase
          .from('schools')
          .select('id')
          .eq('plan_subscription_id', subId)
          .limit(1);
        targetSchoolId = schs?.[0]?.id || null;
      }

      if (!targetSchoolId) {
        console.warn(`[Webhook Sub] Escola não encontrada para subscription ${subId} / ref=${subExtRef}`);
        return res.status(200).json({ received: true, message: 'Escola não encontrada.' });
      }

      // Idempotência via audit_log
      const subAuditKey = `PLAN_SUB_${event}_${subId || subExtRef}`;
      const { data: existingSub } = await supabase
        .from('audit_log')
        .select('id')
        .eq('school_id', targetSchoolId)
        .eq('action', subAuditKey)
        .limit(1);
      if (existingSub && existingSub.length > 0) {
        console.log(`[Webhook Sub] ${subAuditKey} já processado.`);
        return res.status(200).json({ received: true, duplicate: true });
      }

      if (event === 'SUBSCRIPTION_INACTIVATED' || event === 'SUBSCRIPTION_DELETED') {
        // Bloqueia escola: zera subscription e marca expiração no passado
        const epochPast = new Date(0).toISOString();
        await supabase
          .from('schools')
          .update({
            plan_subscription_id: null,
            plan_expires_at:      epochPast,
            school_status:        'inactive',
            updated_at:           new Date().toISOString(),
          })
          .eq('id', targetSchoolId);

        await supabase.from('audit_log').insert({
          school_id: targetSchoolId,
          action:    subAuditKey,
          details:   JSON.stringify({ subscriptionId: subId, externalReference: subExtRef, event }),
        }).catch(e => console.error('[Webhook Sub] audit_log err:', e.message));

        console.log(`[Webhook Sub] 🔒 Escola ${targetSchoolId} BLOQUEADA — assinatura ${subId} inativada (${event})`);

        // Notificar gestor por e-mail
        const { data: schoolData } = await supabase
          .from('schools')
          .select('name, owner_id')
          .eq('id', targetSchoolId)
          .single();
        const { data: userData } = schoolData?.owner_id
          ? await supabase.from('users').select('email').eq('id', schoolData.owner_id).single()
          : { data: null };
        if (userData?.email) {
          fetch(`${VERCEL_URL}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to:       userData.email,
              subject:  '⚠️ Assinatura cancelada — GestEscolar',
              template: 'subscription_inactivated',
              data: {
                schoolName: schoolData?.name || 'Sua Escola',
                loginUrl:   `${VERCEL_URL}/login`,
                reason:     'Não foi possível processar a cobrança recorrente. Atualize seu cartão para reativar o acesso.',
              },
            }),
          }).catch(e => console.error('[Webhook Sub] email err:', e.message));
        }

        return res.status(200).json({ received: true, action: 'school_blocked', schoolId: targetSchoolId });
      }

      // Outros eventos de subscription (CREATED, UPDATED, SPLIT_DISABLED): apenas log
      console.log(`[Webhook Sub] ${event} para escola ${targetSchoolId} — sem ação.`);
      return res.status(200).json({ received: true, event });
    }

    // ───────────────────────────────────────────────────────────
    //  EVENTOS DE STATUS DA SUBCONTA (KYC)
    //  ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED  → conta verificada ✅
    //  ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED  → reprovada
    //  ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING  → em análise
    // ───────────────────────────────────────────────────────────
    if (event && event.startsWith('ACCOUNT_STATUS_')) {
      const accountId = account?.id || body?.id;
      if (!accountId) {
        return res.status(200).json({ received: true, message: 'Sem ID da subconta.' });
      }

      let docStatus = 'pending_verification';
      let message = '';
      if (event.includes('APPROVED'))      docStatus = 'verified';
      else if (event.includes('REJECTED')) {
        docStatus = 'rejected';
        message = account?.rejectReason || account?.rejectReasonDescriptions?.join('; ') || 'Documentos reprovados pelo Asaas.';
      }

      const { data: schools } = await supabase
        .from('schools')
        .select('id, name')
        .eq('asaas_account_id', accountId)
        .limit(1);

      if (schools && schools.length > 0) {
        await supabase
          .from('schools')
          .update({
            asaas_documents_status: docStatus,
            asaas_verification_message: message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', schools[0].id);

        console.log(`[Webhook] Subconta ${accountId} (escola ${schools[0].name}) → status: ${docStatus}`);
      } else {
        console.warn(`[Webhook] Subconta ${accountId} não encontrada no banco.`);
      }
      return res.status(200).json({ received: true, status: docStatus });
    }

    // ───────────────────────────────────────────────────────────
    //  EVENTOS DE PAGAMENTO
    // ───────────────────────────────────────────────────────────
    if (!payment || !payment.id) {
      return res.status(200).json({ received: true, message: 'Sem dados de pagamento.' });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PAGAMENTOS DE PLANO SAAS
    //  Identificados por externalReference no formato "schoolId|planId|billing".
    //  Esses pagamentos NÃO ficam em "invoices" (que é para mensalidades de
    //  alunos). Sem este handler, dinheiro era cobrado mas plano não ativava
    //  caso o usuário fechasse o navegador antes do polling do PIX confirmar.
    // ═══════════════════════════════════════════════════════════════════
    const extRef = payment.externalReference || '';
    const planMatch = extRef.match(/^([0-9a-fA-F-]{36})\|([a-z0-9_]+)\|(mensal|anual|renewal)$/i);
    if (planMatch) {
      const [, planSchoolId, planIdRef, billingRef] = planMatch;
      const planAuditKey = `PLAN_PAY_${event}_${payment.id}`;

      // Idempotência por (school + ação)
      const { data: existingPlan } = await supabase
        .from('audit_log')
        .select('id')
        .eq('school_id', planSchoolId)
        .eq('action', planAuditKey)
        .limit(1);
      if (existingPlan && existingPlan.length > 0) {
        console.log(`[Webhook Plan] ${planAuditKey} já processado.`);
        return res.status(200).json({ received: true, duplicate: true });
      }

      // Confirmação de pagamento → ativa/renova plano
      if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
        const days = billingRef.toLowerCase() === 'anual' ? 365 : 30;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        const updateFields = {
          plan_id:         planIdRef,
          billing:         billingRef.toLowerCase() === 'renewal' ? 'mensal' : billingRef.toLowerCase(),
          plan_expires_at: expiresAt,
          plan_payment_id: payment.id,
          school_status:   'active',
          updated_at:      new Date().toISOString(),
        };
        // Renovação via PIX zera plan_subscription_id (era cartão recorrente que falhou)
        if (billingRef.toLowerCase() === 'renewal') {
          updateFields.plan_subscription_id = null;
        }

        const { error: schUpdErr } = await supabase
          .from('schools')
          .update(updateFields)
          .eq('id', planSchoolId);

        if (schUpdErr) {
          console.error('[Webhook Plan] Erro ao ativar plano:', schUpdErr);
          return res.status(500).json({ error: 'Erro ao ativar plano.' });
        }

        await supabase.from('audit_log').insert({
          school_id: planSchoolId,
          action:    planAuditKey,
          details:   JSON.stringify({ planId: planIdRef, billing: billingRef, paymentId: payment.id, expiresAt, value: payment.value }),
        }).catch(e => console.error('[Webhook Plan] audit_log err:', e.message));

        console.log(`[Webhook Plan] ✅ Plano ${planIdRef} (${billingRef}) ativado para escola ${planSchoolId} — vence em ${expiresAt}`);

        // E-mail de confirmação ao gestor
        const { data: schoolData } = await supabase
          .from('schools')
          .select('name, owner_id')
          .eq('id', planSchoolId)
          .single();
        const { data: userData } = schoolData?.owner_id
          ? await supabase.from('users').select('email').eq('id', schoolData.owner_id).single()
          : { data: null };
        if (userData?.email) {
          fetch(`${VERCEL_URL}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to:       userData.email,
              subject:  '✅ Pagamento confirmado — GestEscolar',
              template: 'payment_confirmed',
              data: {
                schoolName:    schoolData?.name || 'Sua Escola',
                value:         payment.value,
                daysRemaining: days,
                loginUrl:      `${VERCEL_URL}/login`,
              },
            }),
          }).catch(e => console.error('[Webhook Plan] email err:', e.message));
        }

        return res.status(200).json({ received: true, action: 'plan_activated', expiresAt });
      }

      // Pagamento atrasado / cartão recusado → BLOQUEIA escola
      // Para assinaturas recorrentes, esse é o sinal de que o cartão falhou.
      if (event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED') {
        const epochPast = new Date(0).toISOString();
        const { error: schUpdErr } = await supabase
          .from('schools')
          .update({
            plan_expires_at:      epochPast,
            plan_subscription_id: null, // tira proteção da assinatura recorrente
            school_status:        'inactive',
            updated_at:           new Date().toISOString(),
          })
          .eq('id', planSchoolId);

        if (schUpdErr) {
          console.error('[Webhook Plan] Erro ao bloquear escola:', schUpdErr);
          return res.status(500).json({ error: 'Erro ao bloquear escola.' });
        }

        await supabase.from('audit_log').insert({
          school_id: planSchoolId,
          action:    planAuditKey,
          details:   JSON.stringify({ planId: planIdRef, billing: billingRef, paymentId: payment.id, event, value: payment.value }),
        }).catch(e => console.error('[Webhook Plan] audit_log err:', e.message));

        console.log(`[Webhook Plan] 🔒 Escola ${planSchoolId} BLOQUEADA — pagamento ${event} (paymentId=${payment.id})`);

        // Notificar gestor por e-mail
        const { data: schoolData } = await supabase
          .from('schools')
          .select('name, owner_id')
          .eq('id', planSchoolId)
          .single();
        const { data: userData } = schoolData?.owner_id
          ? await supabase.from('users').select('email').eq('id', schoolData.owner_id).single()
          : { data: null };
        if (userData?.email) {
          fetch(`${VERCEL_URL}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to:       userData.email,
              subject:  '⚠️ Pagamento não processado — GestEscolar',
              template: 'payment_failed',
              data: {
                schoolName: schoolData?.name || 'Sua Escola',
                loginUrl:   `${VERCEL_URL}/login`,
                reason:     event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED'
                              ? 'Seu cartão foi recusado pela operadora.'
                              : 'Sua cobrança recorrente não foi paga até o vencimento.',
              },
            }),
          }).catch(e => console.error('[Webhook Plan] email err:', e.message));
        }

        return res.status(200).json({ received: true, action: 'school_blocked', schoolId: planSchoolId, reason: event });
      }

      // Estorno / cancelamento → bloqueia também
      if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED' ||
          event === 'PAYMENT_CHARGEBACK_REQUESTED' || event === 'PAYMENT_CHARGEBACK_DISPUTE' ||
          event === 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL') {
        const epochPast = new Date(0).toISOString();
        await supabase
          .from('schools')
          .update({
            plan_expires_at:      epochPast,
            plan_subscription_id: null,
            school_status:        'inactive',
            updated_at:           new Date().toISOString(),
          })
          .eq('id', planSchoolId);

        await supabase.from('audit_log').insert({
          school_id: planSchoolId,
          action:    planAuditKey,
          details:   JSON.stringify({ planId: planIdRef, billing: billingRef, paymentId: payment.id, event }),
        }).catch(e => console.error('[Webhook Plan] audit_log err:', e.message));

        console.log(`[Webhook Plan] 🔒 Escola ${planSchoolId} BLOQUEADA por estorno/cancelamento (${event})`);
        return res.status(200).json({ received: true, action: 'school_blocked', reason: event });
      }

      // Outros eventos de plano (CREATED, RESTORED, etc.): apenas log
      console.log(`[Webhook Plan] Evento ${event} para escola ${planSchoolId} — sem ação.`);
      return res.status(200).json({ received: true, event, planEvent: true });
    }
    // ═══════════════════════════════════════════════════════════════════
    //  FIM: pagamentos de plano. Restante é mensalidade de aluno (invoices).
    // ═══════════════════════════════════════════════════════════════════

    // Buscar invoice pelo asaas_id (incluindo payment_method para não sobrescrever espécie)
    const { data: invoices, error: findErr } = await supabase
      .from('invoices')
      .select('id, school_id, student_id, amount, status, payment_method')
      .eq('asaas_id', payment.id)
      .limit(1);

    if (findErr || !invoices || invoices.length === 0) {
      console.log(`[Webhook] Invoice não encontrada para asaas_id=${payment.id}`);
      return res.status(200).json({ received: true, message: 'Invoice não encontrada.' });
    }

    const invoice = invoices[0];

    // Mapear eventos Asaas para status do sistema
    let newStatus = null;
    let paidAt = null;

    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        newStatus = 'pago';
        paidAt = payment.confirmedDate || payment.paymentDate || new Date().toISOString();
        break;
      case 'PAYMENT_OVERDUE':
        newStatus = 'vencido';
        break;
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_RESTORED':
        newStatus = 'cancelado';
        break;
      default:
        // Outros eventos: apenas registrar
        console.log(`[Webhook] Evento ${event} não processado.`);
        return res.status(200).json({ received: true, event });
    }

    // Valor real pago (pode ser maior que invoice.amount se houve multa/juros)
    // payment.value = valor bruto cobrado do pagador (já inclui fines/interest que setamos)
    const parsedPayment = parseFloat(payment.value);
    const parsedInvoice = parseFloat(invoice.amount);
    const actualPaidAmount = Number.isFinite(parsedPayment) && parsedPayment > 0
      ? parsedPayment
      : (Number.isFinite(parsedInvoice) && parsedInvoice > 0 ? parsedInvoice : 0);
    if (actualPaidAmount === 0 && newStatus === 'pago') {
      console.error('[Webhook] Valor pago indeterminado para payment', payment.id, 'invoice', invoice.id);
    }

    // Atualizar invoice
    const updateData = { status: newStatus };
    if (paidAt) {
      updateData.paid_at = paidAt;
      // Registrar o valor efetivamente pago (com multa/juros se vencida)
      updateData.paid_amount = actualPaidAmount;
      // Só define payment_method como pix_asaas se ainda NÃO foi registrado como espécie
      // (evita sobrescrever pagamento em espécie com PIX do Asaas)
      if (invoice.payment_method !== 'especie') {
        updateData.payment_method = 'pix_asaas';
      } else {
        console.log(`[Webhook] Invoice ${invoice.id} já registrada como espécie — mantendo classificação.`);
      }
    }

    const { error: updateErr } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoice.id);

    if (updateErr) {
      console.error('[Webhook] Erro ao atualizar invoice:', updateErr);
      return res.status(500).json({ error: 'Erro ao atualizar invoice.' });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ESTORNO/CANCELAMENTO: se a invoice estava 'pago' e foi cancelada,
    // precisamos criar transação de DÉBITO para reverter o crédito
    // anterior. Sem isso, o saldo local fica inflado indefinidamente.
    // ═══════════════════════════════════════════════════════════════════
    if (newStatus === 'cancelado' && invoice.status === 'pago') {
      const refundDescription = `Estorno PIX (Asaas: ${payment.id} | evento: ${event})`;
      const { data: existingRefund } = await supabase
        .from('transactions')
        .select('id')
        .eq('school_id', invoice.school_id)
        .eq('description', refundDescription)
        .limit(1);

      if (!existingRefund || existingRefund.length === 0) {
        const refundAmount = Number(invoice.paid_amount) || Number(payment.value) || Number(invoice.amount) || 0;
        if (refundAmount > 0) {
          await supabase.from('transactions').insert({
            school_id: invoice.school_id,
            type: 'debit',
            amount: refundAmount,
            description: refundDescription,
          });
          console.log(`[Webhook] Estorno registrado: -R$ ${refundAmount.toFixed(2)} para invoice ${invoice.id}`);
        }
      } else {
        console.log(`[Webhook] Estorno para ${payment.id} já registrado — pulando.`);
      }
      // Limpa paid_amount da invoice (o dinheiro foi devolvido)
      await supabase.from('invoices')
        .update({ paid_at: null, paid_amount: 0 })
        .eq('id', invoice.id);
    }

    // Se pago, criar transação de crédito + RENOVAR PLANO DA ESCOLA (CRÍTICO)
    if (newStatus === 'pago') {
      // ═══════════════════════════════════════════════════════════════════
      // IDEMPOTÊNCIA: Asaas dispara PAYMENT_CONFIRMED e PAYMENT_RECEIVED
      // para o mesmo pagamento. Sem este check, transactions duplicam e o
      // saldo local fica em dobro. Buscamos por description contendo o
      // payment.id para detectar duplicata.
      // ═══════════════════════════════════════════════════════════════════
      const txDescription = `Pagamento PIX confirmado (Asaas: ${payment.id})`;
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('school_id', invoice.school_id)
        .eq('description', txDescription)
        .limit(1);

      if (existingTx && existingTx.length > 0) {
        console.log(`[Webhook] Transação para ${payment.id} já existe — pulando inserção (idempotência).`);
        return res.status(200).json({ received: true, duplicate: true, event });
      }

      await supabase.from('transactions').insert({
        school_id: invoice.school_id,
        type: 'credit',
        amount: actualPaidAmount, // valor real pago (com juros/multa)
        description: txDescription,
      });

      // ⚠️ CRÍTICO: Atualizar plan_expires_at da escola se for pagamento de renovação
      // Detecta se é renovação: invoice.description contém "Renovação" ou "Mensalidade"
      const isRenewal = (invoice.description || '').toLowerCase().includes('renov')
                     || (invoice.description || '').toLowerCase().includes('mensalidade');

      if (isRenewal) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // Buscar dados da escola + gestor pra enviar email
        const { data: schoolData } = await supabase
          .from('schools')
          .select('id, name, owner_id')
          .eq('id', invoice.school_id)
          .single();

        const { data: userData } = schoolData?.owner_id
          ? await supabase.from('users').select('email').eq('id', schoolData.owner_id).single()
          : { data: null };

        const { error: schoolErr } = await supabase
          .from('schools')
          .update({
            plan_expires_at: expiresAt,
            school_status: 'active',
            plan_subscription_id: null, // Zera se era cartão recorrente
          })
          .eq('id', invoice.school_id);

        if (schoolErr) {
          console.error('[Webhook] Erro ao renovar plano da escola:', schoolErr);
        } else {
          console.log(`[Webhook] Plano renovado para escola ${invoice.school_id}: vence em ${expiresAt}`);

          // 📧 Enviar email de confirmação (com retry e fallback em audit_log)
          if (userData?.email) {
            const emailPayload = {
              to: userData.email,
              subject: '✅ Pagamento confirmado — GestEscolar',
              template: 'payment_confirmed',
              data: {
                schoolName: schoolData?.name || 'Sua Escola',
                value: actualPaidAmount,
                daysRemaining: 30,
                loginUrl: `${VERCEL_URL}/app/dashboard`,
              },
            };

            const enviarEmail = async () => {
              for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                  const r = await fetch(`${VERCEL_URL}/api/send-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emailPayload),
                  });
                  if (r.ok) {
                    const d = await r.json().catch(() => ({}));
                    console.log(`[Webhook] Email enviado (tentativa ${attempt}): ${d.emailId || 'queued'}`);
                    return true;
                  }
                  console.warn(`[Webhook] Email falhou tentativa ${attempt}: HTTP ${r.status}`);
                } catch (e) {
                  console.warn(`[Webhook] Email erro tentativa ${attempt}:`, e.message);
                }
                if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
              }
              return false;
            };

            enviarEmail().then(ok => {
              if (!ok) {
                // Falha após 3 tentativas — registra para alerta posterior
                supabase.from('audit_log').insert({
                  school_id: invoice.school_id,
                  action: 'EMAIL_PAYMENT_CONFIRMATION_FAILED',
                  details: JSON.stringify({ to: userData.email, paymentId: payment.id, invoiceId: invoice.id }),
                }).catch(e => console.error('[Webhook] Erro ao logar falha de email:', e));
              }
            });
          }
        }

        // Registrar em audit_log
        await supabase.from('audit_log').insert({
          school_id: invoice.school_id,
          action: 'PLAN_RENEWED_PIX',
          details: JSON.stringify({ paymentId: payment.id, expiresAt, amount: invoice.amount }),
        }).catch(e => console.error('[Webhook] Erro ao registrar audit log:', e));
      }

      console.log(`[Webhook] Invoice ${invoice.id} marcada como paga. Transação criada.`);
    }

    return res.status(200).json({ received: true, status: newStatus, invoiceId: invoice.id });
  } catch (err) {
    console.error('[Webhook Error]', err);
    return res.status(500).json({ error: 'Erro interno.', message: err.message });
  }
};
