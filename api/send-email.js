// =============================================
//  GESTESCOLAR – EMAIL COM RESEND
//  Envia confirmações de pagamento, avisos, etc
// =============================================

const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const { checkRateLimit, VALIDATORS, writeAuditLog } = require('./_middleware');

const RESEND_API_KEY    = process.env.RESEND_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Carrega configuração de email do banco (cache de 5 min)
let _cfgCache = null;
let _cfgCacheAt = 0;
async function loadEmailConfig(overrides = {}) {
  const now = Date.now();
  if (!_cfgCache || now - _cfgCacheAt > 300000) {
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data } = await sb.from('platform_settings').select('key,value').eq('group','email');
      _cfgCache = {};
      (data || []).forEach(r => { _cfgCache[r.key] = r.value; });
      _cfgCacheAt = now;
    } catch (e) { _cfgCache = {}; }
  }
  return { ..._cfgCache, ...overrides };
}

module.exports = async function handler(req, res) {
  // Anti-cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  if (!RESEND_API_KEY) {
    console.error('[Email] RESEND_API_KEY não configurada');
    return res.status(500).json({ error: 'Configuração de email incompleta.' });
  }

  // ── AUTENTICAÇÃO OBRIGATÓRIA ───────────────────
  // Endpoint não é público — exige token Supabase válido
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SERVICE_KEY },
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Sessão inválida.' });
  } catch {
    return res.status(401).json({ error: 'Falha ao validar sessão.' });
  }

  try {
    const { to, subject, template, data, emailConfig: overrides } = req.body;

    if (!to || !subject || !template) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: to, subject, template.' });
    }

    // ── RATE LIMITING ──────────────────────────────
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    const callerId = req.headers.authorization?.slice(-12) || ip;
    const rl = checkRateLimit(callerId, 'send_email');
    if (!rl.ok) {
      res.setHeader('Retry-After', rl.retryAfter);
      return res.status(429).json({ error: `Muitas requisições. Tente em ${rl.retryAfter}s.` });
    }

    // ── VALIDAÇÃO DE INPUT ─────────────────────────
    const validErr = VALIDATORS.send_email({ to, template });
    if (validErr) return res.status(400).json({ error: validErr });

    // Carrega configuração do banco, com overrides opcionais do request (ex: teste do painel)
    const cfg = await loadEmailConfig(overrides || {});
    const senderName    = cfg.senderName    || 'GestEscolar';
    const senderEmail   = cfg.senderEmail   || 'noreply@gestescolar.com.br';
    const primaryColor  = cfg.primaryColor  || '#1a73e8';
    const logoUrl       = cfg.logoUrl       || '';
    const supportEmail  = cfg.supportEmail  || '';
    const footerAddress = cfg.footerAddress || '';
    const footerCnpj    = cfg.footerCnpj    || '';
    const whatsapp      = cfg.whatsapp      || '';
    const instagram     = cfg.instagram     || '';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${senderName}" style="max-height:56px;max-width:200px;">`
      : `<div style="font-size:22px;font-weight:900;color:${primaryColor};">${senderName}</div>`;

    const footerHtml = `
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <div style="text-align:center;font-size:11px;color:#999;line-height:1.7;">
        ${footerAddress ? footerAddress + '<br>' : ''}
        ${footerCnpj ? 'CNPJ: ' + footerCnpj + '<br>' : ''}
        ${supportEmail ? '📧 ' + supportEmail + '&nbsp;&nbsp;' : ''}
        ${whatsapp ? '📱 ' + whatsapp + '&nbsp;&nbsp;' : ''}
        ${instagram ? '📷 ' + instagram : ''}
        <br><br>${senderName} © ${new Date().getFullYear()} — Plataforma SaaS de Gestão Escolar
      </div>`;

    const wrapHtml = (body) => `
      <!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:28px 24px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid ${primaryColor}20;">${logoHtml}</div>
        ${body}${footerHtml}
      </div></body></html>`;

    let html = '';

    // Templates disponíveis
    switch (template) {
      case 'payment_confirmed':
        html = wrapHtml(`
          <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:48px;margin-bottom:8px;">✅</div>
            <h1 style="color:#2e7d32;margin:0;font-size:22px;">Pagamento Confirmado!</h1>
          </div>
          <p style="color:#333;font-size:14px;line-height:1.6;">
            Seu pagamento de <strong>R$ ${Number(data.value).toFixed(2)}</strong> foi confirmado com sucesso.
          </p>
          <div style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:12px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#1b5e20;font-size:13px;">
              <strong>${data.schoolName}</strong> está ativo e pronto para usar!
            </p>
          </div>
          <p style="color:#666;font-size:12px;">Plano vence em <strong>${data.daysRemaining} dias</strong>.</p>
          <div style="text-align:center;margin-top:20px;">
            <a href="${data.loginUrl}" style="display:inline-block;background:${primaryColor};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
              Acessar ${senderName}
            </a>
          </div>`);
        break;

      case 'payment_overdue':
        html = wrapHtml(`
          <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:48px;margin-bottom:8px;">⚠️</div>
            <h1 style="color:#c62828;margin:0;font-size:22px;">Assinatura Vencida</h1>
          </div>
          <p style="color:#333;font-size:14px;line-height:1.6;">
            Sua assinatura venceu em <strong>${data.expiredDate}</strong>.
          </p>
          <div style="background:#ffebee;border-left:4px solid #c62828;padding:12px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#b71c1c;font-size:13px;">
              <strong>Ação necessária:</strong> Renove agora para continuar usando o sistema.
            </p>
          </div>
          <p style="color:#666;font-size:12px;">Seus dados estão preservados e nada será perdido.</p>
          <div style="text-align:center;margin-top:20px;">
            <a href="${data.renewUrl}" style="display:inline-block;background:#c62828;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
              Renovar Agora
            </a>
          </div>`);
        break;

      case 'renewal_warning':
        html = wrapHtml(`
          <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:48px;margin-bottom:8px;">🔔</div>
            <h1 style="color:#f57c00;margin:0;font-size:22px;">Assinatura Vence em ${data.daysRemaining} Dias</h1>
          </div>
          <p style="color:#333;font-size:14px;line-height:1.6;">
            Lembrete: sua assinatura vence em <strong>${data.dueDate}</strong>.
          </p>
          <p style="color:#666;font-size:12px;">Renove agora para evitar interrupção no acesso.</p>
          <div style="text-align:center;margin-top:20px;">
            <a href="${data.renewUrl}" style="display:inline-block;background:${primaryColor};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
              Renovar Assinatura
            </a>
          </div>`);
        break;

      default:
        return res.status(400).json({ error: `Template desconhecido: ${template}` });
    }

    // Enviar com Resend
    const resend = new Resend(RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error('[Email] Erro ao enviar:', result.error);
      return res.status(500).json({ error: 'Erro ao enviar email.', details: result.error });
    }

    console.log(`[Email] ✅ Enviado para ${to}: ${subject} (ID: ${result.data?.id})`);

    // Audit log (fire-and-forget)
    writeAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      userId: null,
      schoolId: null,
      action: 'EMAIL_SENT',
      ip,
      details: { to, subject, template, emailId: result.data?.id },
    });

    return res.status(200).json({ ok: true, emailId: result.data?.id });
  } catch (err) {
    console.error('[Email Error]', err);
    return res.status(500).json({ error: 'Erro interno.', message: err.message });
  }
};
