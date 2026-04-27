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

  // Validar token do webhook
  const token = req.headers['asaas-access-token'] || req.query.token;
  if (token !== WEBHOOK_TOKEN) {
    return res.status(403).json({ error: 'Token inválido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { event, payment } = body;

    console.log(`[Webhook Asaas] Evento: ${event}, Payment ID: ${payment?.id}`);

    if (!payment || !payment.id) {
      return res.status(200).json({ received: true, message: 'Sem dados de pagamento.' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const VERCEL_URL = process.env.VERCEL_URL || 'https://gestescolar.app';

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

    // Atualizar invoice
    const updateData = { status: newStatus };
    if (paidAt) {
      updateData.paid_at = paidAt;
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

    // Se pago, criar transação de crédito + RENOVAR PLANO DA ESCOLA (CRÍTICO)
    if (newStatus === 'pago') {
      await supabase.from('transactions').insert({
        school_id: invoice.school_id,
        type: 'credit',
        amount: invoice.amount,
        description: `Pagamento PIX confirmado (Asaas: ${payment.id})`,
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

          // 📧 Enviar email de confirmação (fire-and-forget)
          if (userData?.email) {
            const emailPayload = {
              to: userData.email,
              subject: '✅ Pagamento confirmado — GestEscolar',
              template: 'payment_confirmed',
              data: {
                schoolName: schoolData?.name || 'Sua Escola',
                value: invoice.amount,
                daysRemaining: 30,
                loginUrl: `${VERCEL_URL}/app/dashboard`,
              },
            };

            fetch(`${VERCEL_URL}/api/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(emailPayload),
            })
              .then(r => r.json())
              .then(d => console.log(`[Webhook] Email enviado: ${d.emailId || 'queued'}`))
              .catch(e => console.error('[Webhook] Erro ao enviar email:', e.message));
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
