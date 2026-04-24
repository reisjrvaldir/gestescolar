// =============================================
//  GESTESCOLAR – MIDDLEWARE DE SEGURANÇA
//  Rate limiting, validação e audit log
// =============================================

// Rate limit em memória (reseta a cada deploy — suficiente para Vercel serverless)
// Formato: { 'userId:action': { count, resetAt } }
const _rl = {};

const RATE_LIMITS = {
  // Asaas — ações custosas
  createPixCharge:          { max: 20,  windowMs: 60000  }, // 20/min por user
  createPlanPixPayment:     { max: 5,   windowMs: 60000  }, // 5/min
  createPlanSubscription:   { max: 5,   windowMs: 60000  }, // 5/min
  createPlanCardPayment:    { max: 5,   windowMs: 60000  }, // 5/min
  createSubaccount:         { max: 3,   windowMs: 300000 }, // 3/5min
  requestWithdraw:          { max: 3,   windowMs: 300000 }, // 3/5min
  // Email — evitar spam
  send_email:               { max: 10,  windowMs: 60000  }, // 10/min por user
  // Password Recovery — muito restritivo para evitar brute force
  sendPasswordRecovery:      { max: 5,   windowMs: 3600000 }, // 5/hora por IP
  resetPasswordWithToken:    { max: 10,  windowMs: 3600000 }, // 10/hora por IP
  // Default para ações não listadas
  default:                  { max: 60,  windowMs: 60000  }, // 60/min
};

function checkRateLimit(userId, action) {
  const cfg = RATE_LIMITS[action] || RATE_LIMITS.default;
  const key = `${userId}:${action}`;
  const now = Date.now();

  if (!_rl[key] || now > _rl[key].resetAt) {
    _rl[key] = { count: 1, resetAt: now + cfg.windowMs };
    return { ok: true };
  }
  _rl[key].count++;
  if (_rl[key].count > cfg.max) {
    const retryAfter = Math.ceil((_rl[key].resetAt - now) / 1000);
    return { ok: false, retryAfter };
  }
  return { ok: true };
}

// Validações de input por ação
const VALIDATORS = {
  createPixCharge: (d) => {
    if (!d.customerId || typeof d.customerId !== 'string') return 'customerId inválido';
    if (!d.value || isNaN(d.value) || d.value <= 0) return 'value inválido';
    if (!d.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) return 'dueDate inválido (YYYY-MM-DD)';
    return null;
  },
  createCustomer: (d) => {
    if (!d.name || d.name.length < 2) return 'name inválido';
    if (!d.cpfCnpj) return 'cpfCnpj obrigatório';
    const digits = d.cpfCnpj.replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 14) return 'cpfCnpj deve ter 11 (CPF) ou 14 (CNPJ) dígitos';
    if (!d.email || !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(d.email)) return 'email inválido';
    return null;
  },
  createPlanPixPayment: (d) => {
    if (!d.customerId) return 'customerId obrigatório';
    if (!d.value || isNaN(d.value) || d.value < 0.01) return 'value inválido (mínimo R$ 0,01)';
    return null;
  },
  createPlanSubscription: (d) => {
    if (!d.customerId) return 'customerId obrigatório';
    if (!d.value || isNaN(d.value) || d.value < 0.01) return 'value inválido';
    if (!d.card?.holderName || !d.card?.number) return 'dados do cartão incompletos';
    return null;
  },
  createPlanCardPayment: (d) => {
    if (!d.customerId) return 'customerId obrigatório';
    if (!d.value || isNaN(d.value) || d.value < 0.01) return 'value inválido';
    if (!d.card?.holderName || !d.card?.number) return 'dados do cartão incompletos';
    return null;
  },
  requestWithdraw: (d) => {
    if (!d.value || isNaN(d.value) || d.value <= 0) return 'value inválido';
    if (!d.pixKey) return 'pixKey obrigatória';
    return null;
  },
  send_email: (d) => {
    if (!d.to || !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(d.to)) return 'email "to" inválido';
    if (!d.template) return 'template obrigatório';
    const allowed = ['payment_confirmed','payment_overdue','renewal_warning'];
    if (!allowed.includes(d.template)) return `template inválido. Permitidos: ${allowed.join(', ')}`;
    return null;
  },
};

// Audit log — grava no Supabase via service key
async function writeAuditLog(supabaseUrl, serviceKey, { userId, schoolId, action, details, ip }) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/audit_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        school_id: schoolId || null,
        action,
        details: JSON.stringify({ userId, ip, ...details }),
      }),
    });
  } catch (e) {
    console.error('[Audit] Falha ao registrar:', e.message);
  }
}

// Ações que sempre geram audit log
const AUDIT_ACTIONS = new Set([
  'createSubaccount','requestWithdraw','createPlanSubscription',
  'createPlanCardPayment','createPlanPixPayment','cancelPlanSubscription',
  'resetPassword','deleteSchool','send_email',
]);

module.exports = { checkRateLimit, VALIDATORS, writeAuditLog, AUDIT_ACTIONS };
