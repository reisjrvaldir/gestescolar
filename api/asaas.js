// =============================================
//  GESTESCOLAR – PROXY SEGURO ASAAS API
//  Vercel Serverless Function (Node.js)
//  Todas as chamadas para Asaas passam por aqui
// =============================================

const { checkRateLimit, VALIDATORS, writeAuditLog, AUDIT_ACTIONS } = require('./_middleware');

const ASAAS_BASE = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

// Wallet ID da conta PRINCIPAL do GestEscolar no Asaas
// (usado para receber a comissão de 3% sobre cobranças das subcontas)
const GESTESCOLAR_WALLET_ID = process.env.ASAAS_PLATFORM_WALLET_ID || null;

// Supabase server-side para validar sessão
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Ações que só gestores/superadmin podem executar
const GESTOR_ONLY_ACTIONS = new Set([
  'createSubaccount', 'requestWithdraw', 'getBalance',
  'listTransfers', 'getSubaccount', 'refreshSubaccountApiKey',
  'uploadAndVerifySchoolDocuments', 'checkSchoolDocumentsStatus',
]);

// Ações que usam a chave master (SaaS) — não precisam de subconta
const PLAN_ACTIONS = new Set([
  'createPlanCustomer', 'createPlanSubscription', 'createPlanCardPayment',
  'createPlanPixPayment', 'getPlanSubscription', 'cancelPlanSubscription',
]);

module.exports = async function handler(req, res) {
  // CORS
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://gestescolar.com.br';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Anti-cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Verificar configuração
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ASAAS_API_KEY) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  try {
    // Parse body primeiro — algumas ações (signupAndBootstrap) não exigem token
    const bodyParsed = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const earlyAction = bodyParsed.action;
    const PUBLIC_ACTIONS = new Set(['signupAndBootstrap', 'sendPasswordRecovery', 'resetPasswordWithToken', 'checkEmailExists']);

    // ── VERIFICAR SE E-MAIL EXISTE (para distinguir email/senha no login) ─
    if (earlyAction === 'checkEmailExists') {
      if (!SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Servidor não configurado' });
      }
      const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
      const rl = checkRateLimit(`checkemail:${ip}`, 'checkEmailExists');
      if (!rl.ok) {
        res.setHeader('Retry-After', rl.retryAfter);
        return res.status(429).json({ error: `Muitas tentativas. Aguarde ${rl.retryAfter}s.` });
      }
      const email = (bodyParsed.data?.email || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        // Lookup direto em public.users (service role bypassa RLS) — O(1), sem limite de 1000
        const { data: userRow, error: lookupErr } = await supabaseAdmin
          .from('users')
          .select('id')
          .ilike('email', email)
          .limit(1)
          .maybeSingle();
        if (lookupErr) {
          console.error('[checkEmailExists] lookup err:', lookupErr.message);
          return res.status(500).json({ error: 'Erro ao verificar e-mail' });
        }
        return res.status(200).json({ success: true, exists: !!userRow });
      } catch (e) {
        console.error('[checkEmailExists]', e);
        return res.status(500).json({ error: 'Erro ao verificar e-mail' });
      }
    }

    // ── RECUPERAÇÃO DE SENHA PÚBLICA (login page) ─────────
    // Usa generateLink do Supabase Admin para gerar token confiável,
    // depois envia e-mail branded via Resend. Sem tabela customizada.
    if (earlyAction === 'sendPasswordRecovery') {
      if (!SUPABASE_SERVICE_KEY || !process.env.RESEND_API_KEY) {
        return res.status(500).json({ error: 'Serviço de email não configurado' });
      }
      const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
      const rl = checkRateLimit(`recovery:${ip}`, 'sendPasswordRecovery');
      if (!rl.ok) {
        res.setHeader('Retry-After', rl.retryAfter);
        return res.status(429).json({ error: `Muitas tentativas. Aguarde ${rl.retryAfter}s.` });
      }
      const email = (bodyParsed.data?.email || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
      }

      const origin = process.env.ALLOWED_ORIGIN || 'https://gestescolar.com.br';

      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // 1. Verificar se e-mail existe em public.users (lookup O(1) via service role, sem limite)
        const { data: userRow, error: lookupErr } = await supabaseAdmin
          .from('users')
          .select('id')
          .ilike('email', email)
          .limit(1)
          .maybeSingle();
        if (lookupErr) {
          console.error('[sendPasswordRecovery] lookup err:', lookupErr.message);
          return res.status(500).json({ error: 'Erro ao verificar e-mail' });
        }
        if (!userRow) {
          return res.status(404).json({ error: 'E-mail não encontrado. Verifique se você usou o e-mail correto ao se cadastrar.' });
        }

        // 2. Gerar link de recovery pelo Supabase Auth (token seguro, 1h validade)
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: `${origin}/login` },
        });

        if (linkErr || !linkData?.properties?.action_link) {
          console.error('[Password Recovery] Erro ao gerar link:', linkErr);
          return res.status(500).json({ error: 'Erro ao gerar link de recuperação.' });
        }

        const resetLink = linkData.properties.action_link;
        console.log('[Password Recovery] Link Supabase gerado para:', email);

        // 3. Enviar e-mail branded via Resend
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'suporte@gestescolar.com.br',
            to: email,
            subject: 'Recuperação de Senha — GestEscolar 🔐',
            html: `
<html>
<head><meta charset="UTF-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;margin:0;padding:0;}
.container{max-width:600px;margin:0 auto;padding:20px;background:#f4f6f9;}
.header{background:linear-gradient(135deg,#1976d2,#1565c0);color:#fff;padding:32px 30px;border-radius:10px 10px 0 0;text-align:center;}
.header h1{margin:0 0 6px;font-size:24px;}
.header p{margin:0;opacity:.85;font-size:14px;}
.content{background:#fff;padding:32px 30px;border-radius:0 0 10px 10px;box-shadow:0 2px 12px rgba(0,0,0,.08);}
.warning{background:#fff8e1;border-left:4px solid #ffc107;padding:14px 16px;margin:20px 0;border-radius:4px;font-size:13px;}
.btn-wrap{text-align:center;margin:28px 0;}
.button{display:inline-block;background:#1976d2;color:#fff!important;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:.3px;}
.link-copy{background:#f4f6f9;border-radius:6px;padding:10px 14px;font-size:11px;word-break:break-all;color:#555;margin-top:16px;}
.footer{margin-top:24px;font-size:12px;color:#999;text-align:center;}
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎓 GestEscolar</h1>
    <p>Recuperação de Senha</p>
  </div>
  <div class="content">
    <p style="font-size:15px;">Olá!</p>
    <p>Recebemos uma solicitação para redefinir a senha da conta associada a este e-mail.</p>
    <div class="warning">
      ⏰ <strong>Este link é válido por 1 hora.</strong><br>
      Se você não solicitou, ignore este e-mail — sua senha não será alterada.
    </div>
    <div class="btn-wrap">
      <a href="${resetLink}" class="button">🔑 Criar Nova Senha</a>
    </div>
    <p style="font-size:13px;color:#777;text-align:center;">Ou copie o link abaixo no navegador:</p>
    <div class="link-copy">${resetLink}</div>
    <div class="footer">
      Dúvidas? <a href="mailto:suporte@gestescolar.com.br" style="color:#1976d2;">suporte@gestescolar.com.br</a>
    </div>
  </div>
</div>
</body>
</html>`,
            replyTo: 'suporte@gestescolar.com.br',
          }),
        });

        const emailData = await emailRes.json();
        if (!emailRes.ok) {
          console.error('[Resend] Erro:', emailRes.status, emailData);
          return res.status(500).json({ error: 'Erro ao enviar e-mail. Tente novamente.' });
        }

        console.log('[Password Recovery] ✅ E-mail enviado via Resend, ID:', emailData.id);
        return res.status(200).json({ success: true, message: 'E-mail de recuperação enviado.' });

      } catch (e) {
        console.error('[Password Recovery] Exceção:', e.message);
        return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
      }
    }

    // ── SIGNUP + BOOTSTRAP PÚBLICO (checkout landing) ─────────
    // Cria auth user (email_confirm=true), schools e users via service key.
    // Rate limited por IP para evitar spam.
    if (earlyAction === 'signupAndBootstrap') {
      const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
      const rl = checkRateLimit(`signup:${ip}`, 'signupAndBootstrap');
      if (!rl.ok) {
        res.setHeader('Retry-After', rl.retryAfter);
        return res.status(429).json({ error: `Muitas tentativas. Aguarde ${rl.retryAfter}s.` });
      }
      const d = bodyParsed.data || {};
      const email = (d.email || '').trim().toLowerCase();
      const password = d.password || '';
      const s = d.school || {};
      const g = d.gestor || {};
      if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: 'Email e senha (≥6) obrigatórios.' });
      }
      if (!s.name || !g.name) {
        return res.status(400).json({ error: 'Nome da escola e do gestor obrigatórios.' });
      }
      // Cria auth user via Supabase Admin
      let authId = null;
      const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email, password, email_confirm: true,
          user_metadata: { name: g.name, role: 'gestor' },
        }),
      });
      const adminData = await adminRes.json();
      if (!adminRes.ok) {
        // Se email já existe, tenta buscar o user
        const msg = (adminData.msg || adminData.error_description || adminData.message || '').toLowerCase();
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          return res.status(409).json({ error: 'Email já cadastrado. Faça login.' });
        }
        console.error('[signupAndBootstrap] admin create err:', adminData);
        return res.status(500).json({ error: 'Erro ao criar usuário: ' + (adminData.msg || adminData.message || 'desconhecido') });
      }
      authId = adminData.id || adminData.user?.id;
      if (!authId) return res.status(500).json({ error: 'auth_id ausente após criação.' });

      const cryptoNode = require('crypto');
      const schoolId = cryptoNode.randomUUID();
      const userId = cryptoNode.randomUUID();
      const now = new Date().toISOString();
      // Validar e normalizar tipo de pessoa Asaas (PJ | MEI | CPF)
      const personType = ['PJ','MEI','CPF'].includes(s.asaasPersonType) ? s.asaasPersonType : 'PJ';
      const docDigits = (s.cnpj || '').replace(/\D/g, '');
      if (personType === 'CPF' && docDigits && docDigits.length !== 11) {
        return res.status(400).json({ error: 'CPF inválido (deve ter 11 dígitos).' });
      }
      if ((personType === 'PJ' || personType === 'MEI') && docDigits && docDigits.length !== 14) {
        return res.status(400).json({ error: 'CNPJ inválido (deve ter 14 dígitos).' });
      }

      const schoolRow = {
        id: schoolId, name: s.name, cnpj: s.cnpj || null, phone: s.phone || null,
        email: s.email || email, plan_id: s.planId || 'free',
        postal_code: s.postalCode || null, address: s.address || null,
        address_number: s.addressNumber || null, complement: s.complement || null,
        province: s.province || null,
        city: s.city || null, state: s.state || null,
        owner_id: userId, status: 'trial',
        school_status: 'trial', trial_started_at: now, created_at: now,
        // KYC Asaas: subconta será criada quando o gestor enviar os documentos
        asaas_person_type: personType,
        asaas_documents_status: 'pending',
      };
      const userRow = {
        id: userId, auth_id: authId, school_id: schoolId,
        name: g.name, email, role: 'gestor',
        phone: g.phone || '', cpf: g.cpf || '', active: true, created_at: now,
      };
      const schoolIns = await fetch(`${SUPABASE_URL}/rest/v1/schools`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify(schoolRow),
      });
      if (!schoolIns.ok) {
        const err = await schoolIns.text();
        console.error('[signupAndBootstrap] school insert err:', err);
        return res.status(500).json({ error: 'Erro ao criar escola: ' + err.slice(0, 200) });
      }
      const userIns = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify(userRow),
      });
      if (!userIns.ok) {
        const err = await userIns.text();
        console.error('[signupAndBootstrap] user insert err:', err);
        return res.status(500).json({ error: 'Erro ao criar gestor: ' + err.slice(0, 200) });
      }
      return res.status(200).json({ authId, schoolId, userId });
    }

    // ── RESETAR SENHA COM TOKEN (from email) — PÚBLICO, sem auth ────────
    if (earlyAction === 'resetPasswordWithToken') {
      if (!SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Configuração incompleta' });
      }

      const email = (bodyParsed.data?.email || '').trim().toLowerCase();
      const resetToken = bodyParsed.data?.resetToken || '';
      const newPassword = bodyParsed.data?.newPassword || '';
      const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';

      // Rate limiting por IP para reset de senha
      const rl = checkRateLimit(`reset:${ip}`, 'resetPasswordWithToken');
      if (!rl.ok) {
        res.setHeader('Retry-After', rl.retryAfter);
        return res.status(429).json({ error: `Muitas tentativas. Aguarde ${rl.retryAfter}s.` });
      }

      if (!email || !resetToken || !newPassword) {
        return res.status(400).json({ error: 'Email, token e senha obrigatórios' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' });
      }

      console.log('[Password Reset] Validando token para:', email);
      try {
        const cryptoNode = require('crypto');
        const supabaseAdmin = require('@supabase/supabase-js').createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Hashear token recebido para comparar com o armazenado (novo schema)
        const tokenHash = cryptoNode.createHash('sha256').update(resetToken).digest('hex');

        // Validar token na tabela - Compatibilidade com ambos schemas (legado e novo)
        let tokenValid = false;
        let tokenData = null;
        try {
          // Buscar TODOS os tokens do email (sem filtrar por coluna para compatibilidade)
          const { data: tokens, error: tokenErr } = await supabaseAdmin
            .from('password_reset_tokens')
            .select('*')
            .eq('email', email)
            .order('created_at', { ascending: false })
            .limit(10);

          console.log('[Password Reset] Tokens encontrados para', email, ':', tokens?.length || 0);

          if (!tokenErr && tokens && tokens.length > 0) {
            // Apenas token_hash (SHA256) — comparação plain text removida por segurança.
            // Tokens legados sem hash são tratados como inválidos.
            for (const t of tokens) {
              if (t.token_hash && t.token_hash === tokenHash) {
                console.log('[Password Reset] Token encontrado via token_hash');
                tokenData = t;
                break;
              }
            }

            if (tokenData) {
              // Verificar expiração
              if (new Date(tokenData.expires_at) >= new Date()) {
                tokenValid = true;
              } else {
                console.log('[Password Reset] Token expirado para:', email);
                try { await supabaseAdmin.from('password_reset_tokens').delete().eq('id', tokenData.id); } catch (_) {}
              }
            }
          } else if (tokenErr) {
            console.error('[Password Reset] Erro ao buscar tokens:', tokenErr);
          }
        } catch (tableErr) {
          console.error('[Password Reset] ERRO: Tabela password_reset_tokens não acessível:', tableErr.message);
          return res.status(500).json({ error: 'Serviço indisponível. Contate o administrador.' });
        }

        if (!tokenValid) {
          console.warn('[Password Reset] ❌ Token inválido/expirado para email:', email, 'IP:', ip);
          return res.status(401).json({ error: 'Token inválido ou expirado. Solicite um novo link.' });
        }

        // Registrar tentativa de reset bem-sucedida
        writeAuditLog?.({
          email,
          action: 'PASSWORD_RESET_ATTEMPT',
          details: { success: true, ip },
          timestamp: new Date().toISOString(),
        });

        // Buscar usuário pelo email
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
        if (authErr) return res.status(500).json({ error: 'Erro ao buscar usuário' });

        const authUser = authData.users?.find(u => u.email?.toLowerCase() === email);
        if (!authUser) return res.status(404).json({ error: 'Usuário não encontrado' });

        // Atualizar senha
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password: newPassword });
        if (updateErr) {
          console.error('[Password Reset] Erro ao atualizar senha:', updateErr);
          return res.status(500).json({ error: 'Erro ao atualizar senha: ' + updateErr.message });
        }

        // Deletar token após uso (usando ID, que é mais seguro que usar token ou hash)
        if (tokenData?.id) {
          try { await supabaseAdmin.from('password_reset_tokens').delete().eq('id', tokenData.id); } catch (_) {}
        }

        console.log('[Password Reset] ✅ Senha resetada com sucesso para:', email);
        return res.status(200).json({ success: true, message: 'Senha alterada com sucesso' });
      } catch (e) {
        console.error('[Password Reset] Erro:', e);
        return res.status(500).json({ error: 'Erro ao resetar senha: ' + e.message });
      }
    }

    // Validar token Supabase do requisitante
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação ausente.' });
    }
    const token = authHeader.replace('Bearer ', '');

    // Verificar sessão no Supabase
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SERVICE_KEY || '' },
    });
    if (!userRes.ok) {
      return res.status(401).json({ error: 'Sessão inválida.' });
    }
    const authUser = await userRes.json();
    const authUserId = authUser?.id;

    // Buscar role e school_id do usuário na tabela users
    let userRole = null;
    let userSchoolId = null;
    let schoolApiKey = null;

    if (authUserId && SUPABASE_SERVICE_KEY) {
      // Retry até 3x (500ms) — signup recém feito pode ainda não ter propagado o registro users
      for (let attempt = 0; attempt < 3; attempt++) {
        const dbUserRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${authUserId}&select=school_id,role&limit=1`,
          { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        if (dbUserRes.ok) {
          const dbUsers = await dbUserRes.json();
          if (dbUsers && dbUsers[0]) {
            userRole = dbUsers[0].role;
            userSchoolId = dbUsers[0].school_id;
            break;
          }
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 500));
      }
    }

    // Extrair ação e dados do body
    const { action, data } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    if (!action) {
      return res.status(400).json({ error: 'Parâmetro "action" obrigatório.' });
    }

    // ── BOOTSTRAP CHECKOUT: cria school+gestor via service key (bypass RLS) ──
    if (action === 'bootstrapCheckout') {
      if (!authUserId) return res.status(401).json({ error: 'Sessão necessária.' });
      const s = data?.school || {};
      const g = data?.gestor || {};
      if (!s.name || !g.name || !g.email) {
        return res.status(400).json({ error: 'school.name, gestor.name e gestor.email obrigatórios.' });
      }
      // Se já existe user com este auth_id, retorna dados existentes (idempotente)
      const existRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${authUserId}&select=id,school_id,role&limit=1`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      if (existRes.ok) {
        const arr = await existRes.json();
        if (arr && arr[0]?.school_id) {
          return res.status(200).json({ schoolId: arr[0].school_id, userId: arr[0].id, existed: true });
        }
      }
      const schoolId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('crypto').randomUUID();
      const userId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('crypto').randomUUID();
      const now = new Date().toISOString();
      const schoolRow = {
        id: schoolId, name: s.name, cnpj: s.cnpj || null, phone: s.phone || null,
        email: s.email || g.email, plan_id: s.planId || 'free',
        postal_code: s.postalCode || null, address: s.address || null,
        address_number: s.addressNumber || null, complement: s.complement || null,
        city: s.city || null, state: s.state || null,
        owner_id: userId, status: 'trial', created_at: now,
      };
      const userRow = {
        id: userId, auth_id: authUserId, school_id: schoolId,
        name: g.name, email: g.email, role: 'gestor',
        phone: g.phone || '', cpf: g.cpf || '', active: true, created_at: now,
      };
      const schoolIns = await fetch(`${SUPABASE_URL}/rest/v1/schools`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify(schoolRow),
      });
      if (!schoolIns.ok) {
        const err = await schoolIns.text();
        console.error('[bootstrapCheckout] school insert err:', err);
        return res.status(500).json({ error: 'Erro ao criar escola: ' + err.slice(0, 200) });
      }
      const userIns = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify(userRow),
      });
      if (!userIns.ok) {
        const err = await userIns.text();
        console.error('[bootstrapCheckout] user insert err:', err);
        return res.status(500).json({ error: 'Erro ao criar gestor: ' + err.slice(0, 200) });
      }
      return res.status(200).json({ schoolId, userId, existed: false });
    }

    // ── RATE LIMITING ──────────────────────────────
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
    const rl = checkRateLimit(authUserId || ip, action);
    if (!rl.ok) {
      res.setHeader('Retry-After', rl.retryAfter);
      return res.status(429).json({ error: `Muitas requisições. Tente novamente em ${rl.retryAfter}s.` });
    }

    // ── VALIDAÇÃO DE INPUT ─────────────────────────
    if (data && VALIDATORS[action]) {
      const validErr = VALIDATORS[action](data);
      if (validErr) {
        return res.status(400).json({ error: `Validação: ${validErr}` });
      }
    }

    // Verificar permissão: ações sensíveis apenas para gestor/superadmin
    if (GESTOR_ONLY_ACTIONS.has(action) && userRole !== 'gestor' && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Permissão insuficiente para esta operação.' });
    }

    // Buscar API key da subconta no servidor (nunca do cliente)
    if (!PLAN_ACTIONS.has(action) && userSchoolId && SUPABASE_SERVICE_KEY) {
      const schoolRes = await fetch(
        `${SUPABASE_URL}/rest/v1/schools?id=eq.${userSchoolId}&select=asaas_sub_api_key&limit=1`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      if (schoolRes.ok) {
        const schools = await schoolRes.json();
        schoolApiKey = schools?.[0]?.asaas_sub_api_key || null;
      }
    }

    // ── HANDLER ESPECIAL: refreshSubaccountApiKey ──────────────────────────────
    // Tenta múltiplas abordagens em cascata para recuperar a API key da subconta.
    // Usa ASAAS_API_KEY (master) diretamente para todas as tentativas.
    if (action === 'refreshSubaccountApiKey') {
      const accountId = data.accountId;
      const targetSchoolId = (userRole === 'superadmin' && data.schoolId)
        ? data.schoolId
        : userSchoolId;
      const masterHeaders = {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      };

      const safeJsonFetch = async (url, opts = {}) => {
        try {
          const r = await fetch(url, { headers: masterHeaders, ...opts });
          const txt = await r.text();
          console.log(`[refreshSubaccountApiKey] ${opts.method || 'GET'} ${url} → ${r.status}: ${txt.slice(0, 300)}`);
          try { return { status: r.status, ok: r.ok, data: JSON.parse(txt) }; }
          catch (_) { return { status: r.status, ok: r.ok, data: null, rawText: txt.slice(0, 200) }; }
        } catch (e) {
          console.error(`[refreshSubaccountApiKey] fetch error ${url}:`, e.message);
          return { status: 0, ok: false, data: null };
        }
      };

      let foundKey = null;

      // Tentativa 1: POST /accounts/api_key/{accountId}
      if (!foundKey && accountId) {
        const r1 = await safeJsonFetch(`${ASAAS_BASE}/accounts/api_key/${accountId}`, {
          method: 'POST', body: JSON.stringify({}),
        });
        foundKey = r1.data?.apiKey || r1.data?.api_key || r1.data?.accessToken || r1.data?.access_token || null;
      }

      // Tentativa 2: GET /accounts/{accountId} — alguns planos retornam apiKey
      if (!foundKey && accountId) {
        const r2 = await safeJsonFetch(`${ASAAS_BASE}/accounts/${accountId}`);
        foundKey = r2.data?.apiKey || r2.data?.api_key || r2.data?.accessToken || null;
      }

      // Tentativa 3: GET /accounts — listar todas subcontas e achar pelo id
      if (!foundKey) {
        const r3 = await safeJsonFetch(`${ASAAS_BASE}/accounts?limit=100`);
        if (r3.data?.data && Array.isArray(r3.data.data)) {
          const found = r3.data.data.find(a => a.id === accountId || a.walletId === accountId);
          foundKey = found?.apiKey || found?.api_key || found?.accessToken || null;
        }
      }

      // Se encontrou a chave, salvar no Supabase automaticamente
      if (foundKey && targetSchoolId) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/schools?id=eq.${targetSchoolId}`, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ asaas_sub_api_key: foundKey }),
          });
          console.log(`[refreshSubaccountApiKey] ✅ API key salva para escola ${targetSchoolId}`);
        } catch (saveErr) {
          console.error('[refreshSubaccountApiKey] Erro ao salvar no Supabase:', saveErr.message);
        }
      }

      return res.status(200).json({
        apiKey: foundKey,
        schoolId: targetSchoolId,
        warning: foundKey ? null : 'Não foi possível recuperar a API key automaticamente. O Asaas não disponibiliza esse endpoint. Configure manualmente.',
      });
    }
    // ── FIM HANDLER ESPECIAL refreshSubaccountApiKey ───────────────────────────

    // ══════════════════════════════════════════════════════════════════════════
    //  HANDLER ESPECIAL: uploadAndVerifySchoolDocuments
    //  Recebe documentos em base64, faz upload para Supabase Storage,
    //  cria a subconta Asaas (se ainda não existe) e envia os documentos
    //  para verificação KYC no Asaas.
    // ══════════════════════════════════════════════════════════════════════════
    if (action === 'uploadAndVerifySchoolDocuments') {
      const targetSchoolId = (userRole === 'superadmin' && data.schoolId)
        ? data.schoolId
        : userSchoolId;

      if (!targetSchoolId) {
        return res.status(400).json({ error: 'School ID não informado.' });
      }

      // 1. Carregar dados completos da escola do Supabase
      const schoolUrl = `${SUPABASE_URL}/rest/v1/schools?id=eq.${targetSchoolId}&limit=1`;
      const schoolFetch = await fetch(schoolUrl, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      if (!schoolFetch.ok) {
        return res.status(500).json({ error: 'Falha ao carregar escola.' });
      }
      const schoolRows = await schoolFetch.json();
      const school = schoolRows?.[0];
      if (!school) {
        return res.status(404).json({ error: 'Escola não encontrada.' });
      }

      // 2. Validar dados mínimos da escola
      const cpfCnpjDigits = (school.cnpj || '').replace(/\D/g, '');
      const personType = school.asaas_person_type || 'PJ';
      if (!school.name || !school.email || !cpfCnpjDigits) {
        return res.status(400).json({
          error: 'Dados da escola incompletos. Preencha nome, e-mail e CNPJ/CPF antes de enviar documentos.'
        });
      }
      if (personType === 'CPF' && cpfCnpjDigits.length !== 11) {
        return res.status(400).json({ error: 'CPF inválido.' });
      }
      if ((personType === 'PJ' || personType === 'MEI') && cpfCnpjDigits.length !== 14) {
        return res.status(400).json({ error: 'CNPJ inválido.' });
      }

      // 3. Validar arquivos recebidos
      const filesIn = data.files || {};
      const fileKeys = Object.keys(filesIn);
      if (fileKeys.length === 0) {
        return res.status(400).json({ error: 'Nenhum documento enviado.' });
      }

      // Limites de segurança: máximo 5MB por arquivo, mime types restritos
      const MAX_BYTES = 5 * 1024 * 1024;
      const ALLOWED_MIMES = new Set(['application/pdf','image/jpeg','image/png','image/jpg','image/webp']);
      for (const k of fileKeys) {
        const f = filesIn[k];
        if (!f || !f.base64 || !f.mime) {
          return res.status(400).json({ error: `Arquivo "${k}" inválido.` });
        }
        if (!ALLOWED_MIMES.has(f.mime)) {
          return res.status(400).json({ error: `Tipo do arquivo "${k}" não permitido.` });
        }
        // Estimar tamanho a partir do base64 (4 chars = 3 bytes)
        const approxBytes = Math.floor(f.base64.length * 3 / 4);
        if (approxBytes > MAX_BYTES) {
          return res.status(400).json({ error: `Arquivo "${k}" excede 5MB.` });
        }
      }

      // 4. Upload dos arquivos para Supabase Storage (bucket: school-documents)
      const uploadedDocs = { ...(school.asaas_documents || {}) };
      const bucketName = 'school-documents';
      const nowIso = new Date().toISOString();

      for (const docKey of fileKeys) {
        const f = filesIn[docKey];
        const ext = (f.mime.split('/')[1] || 'bin').replace('jpeg', 'jpg');
        const safeName = `${targetSchoolId}/${docKey}_${Date.now()}.${ext}`;
        const buffer = Buffer.from(f.base64, 'base64');

        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucketName}/${safeName}`;
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': f.mime,
            'x-upsert': 'true',
          },
          body: buffer,
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          console.error(`[uploadDocs] Falha upload ${docKey}:`, uploadRes.status, errText.slice(0, 200));
          return res.status(500).json({
            error: `Falha ao enviar arquivo "${docKey}". Verifique se o bucket "${bucketName}" existe.`
          });
        }

        // URL assinada (privada). Validade de 7 dias para o gestor visualizar.
        const signedUrlRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/sign/${bucketName}/${safeName}`,
          {
            method: 'POST',
            headers: {
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
          }
        );
        let signedUrl = '';
        if (signedUrlRes.ok) {
          const sj = await signedUrlRes.json();
          signedUrl = sj?.signedURL || sj?.signedUrl || '';
          if (signedUrl && !signedUrl.startsWith('http')) {
            signedUrl = `${SUPABASE_URL}/storage/v1${signedUrl}`;
          }
        }

        uploadedDocs[docKey] = {
          path: safeName,
          url: signedUrl,
          fileName: f.name || `${docKey}.${ext}`,
          mime: f.mime,
          uploadedAt: nowIso,
        };
      }

      // 5. Criar subconta Asaas se ainda não existe
      let asaasAccountId = school.asaas_account_id || '';
      let asaasWalletId  = school.asaas_wallet_id  || '';
      let asaasApiKey    = school.asaas_sub_api_key || '';

      const masterHeaders = {
        access_token: ASAAS_API_KEY,
        'Content-Type': 'application/json',
      };

      if (!asaasAccountId) {
        // Mapear tipo de pessoa para companyType do Asaas
        // PJ → LIMITED ou ASSOCIATION (usaremos LIMITED para empresas privadas)
        // MEI → MEI
        // CPF → não enviar companyType (pessoa física)
        let companyType;
        if (personType === 'PJ')  companyType = 'LIMITED';
        else if (personType === 'MEI') companyType = 'MEI';
        else companyType = undefined; // CPF

        const subBody = {
          name:          school.name,
          email:         school.email,
          cpfCnpj:       cpfCnpjDigits,
          phone:         school.phone ? school.phone.replace(/\D/g, '') : undefined,
          mobilePhone:   school.phone ? school.phone.replace(/\D/g, '') : undefined,
          incomeValue:   5000,
          postalCode:    (school.postal_code || '').replace(/\D/g, ''),
          address:       school.address,
          addressNumber: school.address_number,
          complement:    school.complement,
          province:      school.province,
        };
        if (companyType) subBody.companyType = companyType;

        const subRes = await fetch(`${ASAAS_BASE}/accounts`, {
          method: 'POST',
          headers: masterHeaders,
          body: JSON.stringify(subBody),
        });
        const subText = await subRes.text();
        let subData = {};
        try { subData = JSON.parse(subText); } catch (_) {}

        if (!subRes.ok) {
          console.error('[uploadDocs] Falha createSubaccount:', subRes.status, subText.slice(0, 300));
          return res.status(subRes.status).json({
            error: subData.errors?.[0]?.description || subData.message || 'Falha ao criar subconta no Asaas.'
          });
        }
        asaasAccountId = subData.id || '';
        asaasWalletId  = subData.walletId || '';
        asaasApiKey    = subData.apiKey || '';

        // CRÍTICO: o Asaas DEVE retornar a apiKey ao criar a subconta.
        // Se não retornou, tentamos recuperar imediatamente via endpoint dedicado.
        // Sem isso, a escola fica sem acesso à própria subconta (não consegue
        // consultar saldo nem sacar). Tentamos antes de aceitar o cadastro.
        if (!asaasApiKey && asaasAccountId) {
          console.warn('[uploadDocs] Asaas não retornou apiKey na criação — tentando recuperar...');
          try {
            const recoverRes = await fetch(`${ASAAS_BASE}/accounts/api_key/${asaasAccountId}`, {
              method: 'POST',
              headers: masterHeaders,
            });
            const recoverText = await recoverRes.text();
            let recoverData = {};
            try { recoverData = JSON.parse(recoverText); } catch (_) {}
            if (recoverRes.ok && recoverData.apiKey) {
              asaasApiKey = recoverData.apiKey;
              console.log('[uploadDocs] apiKey recuperada com sucesso após criação');
            } else {
              console.error('[uploadDocs] Recuperação de apiKey falhou:', recoverRes.status, recoverText.slice(0, 200));
            }
          } catch (e) {
            console.error('[uploadDocs] Erro ao recuperar apiKey:', e.message);
          }
        }

        // Se ainda assim não temos a apiKey, abortamos com erro claro
        // (em vez de deixar a escola em estado inconsistente).
        if (!asaasApiKey) {
          return res.status(502).json({
            error: 'Subconta criada no Asaas mas a chave de acesso não foi retornada. Entre em contato com o suporte do GestEscolar.',
            accountId: asaasAccountId,
            walletId: asaasWalletId,
          });
        }
      }

      // 6. Enviar documentos ao Asaas para verificação KYC
      //    Endpoint: POST /myAccount/documents/{documentId}
      //    Mapeamento dos document keys do GestEscolar para os tipos do Asaas:
      //    - identification → IDENTIFICATION
      //    - addressProof   → ADDRESS_PROOF
      //    - cnpjCard       → CUSTOM (Cartão CNPJ)
      //    - socialContract → SOCIAL_CONTRACT
      //    - ccmei          → CUSTOM (CCMEI)
      //    - cpfDoc         → IDENTIFICATION
      const asaasDocTypeMap = {
        identification:  'IDENTIFICATION',
        addressProof:    'ADDRESS_PROOF',
        cnpjCard:        'CUSTOM',
        socialContract:  'SOCIAL_CONTRACT',
        ccmei:           'CUSTOM',
        cpfDoc:          'IDENTIFICATION',
      };

      // Se temos a apiKey da subconta, enviamos os docs com ela (a partir da própria subconta)
      const docHeaders = asaasApiKey
        ? { access_token: asaasApiKey }
        : masterHeaders;

      // Listar documentos pendentes na subconta Asaas para descobrir os IDs
      let pendingDocsList = [];
      try {
        const listRes = await fetch(`${ASAAS_BASE}/myAccount/documents`, {
          method: 'GET',
          headers: docHeaders,
        });
        if (listRes.ok) {
          const lj = await listRes.json();
          pendingDocsList = lj?.data || [];
        }
      } catch (e) {
        console.warn('[uploadDocs] Erro ao listar docs Asaas:', e.message);
      }

      // Para cada arquivo, enviar para o Asaas via multipart
      for (const docKey of fileKeys) {
        const f = filesIn[docKey];
        const targetType = asaasDocTypeMap[docKey] || 'CUSTOM';
        const matchingDoc = pendingDocsList.find(d => d.type === targetType && d.status !== 'APPROVED');
        if (!matchingDoc) {
          console.warn(`[uploadDocs] Sem slot pendente para ${docKey} (${targetType}) — pulando.`);
          continue;
        }

        const buffer = Buffer.from(f.base64, 'base64');
        const boundary = '----GestEscolarBoundary' + Date.now();
        const multipartBody = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="documentFile"; filename="${f.name || docKey}"\r\nContent-Type: ${f.mime}\r\n\r\n`),
          buffer,
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);

        const sendRes = await fetch(`${ASAAS_BASE}/myAccount/documents/${matchingDoc.id}`, {
          method: 'POST',
          headers: {
            access_token: docHeaders.access_token,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: multipartBody,
        });
        if (!sendRes.ok) {
          const eText = await sendRes.text();
          console.error(`[uploadDocs] Erro envio ${docKey} → Asaas:`, sendRes.status, eText.slice(0, 200));
        }
      }

      // 7. Atualizar Supabase com URLs dos docs e status
      const updatePayload = {
        asaas_documents: uploadedDocs,
        asaas_documents_status: 'pending_verification',
        asaas_documents_submitted_at: nowIso,
        asaas_account_id: asaasAccountId,
        asaas_wallet_id:  asaasWalletId,
        asaas_sub_api_key: asaasApiKey,
        updated_at: nowIso,
      };
      // CRÍTICO: validar que o save no Supabase persistiu de fato.
      // Sem isso, a apiKey pode ficar perdida e a escola fica sem acesso à subconta.
      let saveOk = false;
      try {
        const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/schools?id=eq.${targetSchoolId}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(updatePayload),
        });
        saveOk = saveRes.ok;
        if (!saveOk) {
          const errText = await saveRes.text();
          console.error('[uploadDocs] Supabase PATCH falhou:', saveRes.status, errText.slice(0, 300));
        }
      } catch (saveErr) {
        console.error('[uploadDocs] Erro ao salvar no Supabase:', saveErr.message);
      }
      if (!saveOk) {
        // Subconta foi criada no Asaas mas não conseguimos persistir os dados.
        // Retornamos os dados ao cliente para tentar novamente / contato suporte.
        return res.status(500).json({
          error: 'Subconta criada no Asaas mas não foi possível salvar no banco. Anote os dados e contate o suporte.',
          accountId: asaasAccountId,
          walletId:  asaasWalletId,
          apiKey:    asaasApiKey, // só retornamos para fallback manual de suporte
        });
      }

      return res.status(200).json({
        ok: true,
        accountId: asaasAccountId,
        walletId:  asaasWalletId,
        apiKey:    asaasApiKey,
        documents: uploadedDocs,
        status: 'pending_verification',
      });
    }
    // ── FIM HANDLER uploadAndVerifySchoolDocuments ─────────────────────────────

    // ══════════════════════════════════════════════════════════════════════════
    //  HANDLER ESPECIAL: checkSchoolDocumentsStatus
    //  Consulta o Asaas e atualiza schools.asaas_documents_status conforme retorno
    // ══════════════════════════════════════════════════════════════════════════
    if (action === 'checkSchoolDocumentsStatus') {
      const targetSchoolId = (userRole === 'superadmin' && data.schoolId)
        ? data.schoolId
        : userSchoolId;
      if (!targetSchoolId) {
        return res.status(400).json({ error: 'School ID não informado.' });
      }

      // Carregar escola
      const schoolUrl = `${SUPABASE_URL}/rest/v1/schools?id=eq.${targetSchoolId}&select=asaas_account_id,asaas_sub_api_key&limit=1`;
      const sFetch = await fetch(schoolUrl, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      const sRows = sFetch.ok ? await sFetch.json() : [];
      const sch = sRows?.[0];
      if (!sch?.asaas_account_id) {
        return res.status(404).json({ error: 'Subconta Asaas ainda não foi criada.' });
      }

      const checkHeaders = sch.asaas_sub_api_key
        ? { access_token: sch.asaas_sub_api_key }
        : { access_token: ASAAS_API_KEY };

      // Consultar status geral da subconta + status dos documentos
      const [accRes, docsRes] = await Promise.all([
        fetch(`${ASAAS_BASE}/myAccount/status`, { headers: checkHeaders }),
        fetch(`${ASAAS_BASE}/myAccount/documents`, { headers: checkHeaders }),
      ]);
      const accData  = accRes.ok  ? await accRes.json()  : null;
      const docsData = docsRes.ok ? await docsRes.json() : null;

      // Determinar status agregado
      let status = 'pending_verification';
      let message = '';

      const general = (accData?.general || '').toUpperCase(); // APPROVED | AWAITING_APPROVAL | REJECTED | PENDING
      if (general === 'APPROVED') status = 'verified';
      else if (general === 'REJECTED') {
        status = 'rejected';
        message = accData?.rejectReasonDescriptions?.join('; ') || 'Documentos reprovados pelo Asaas.';
      }

      // Atualizar Supabase
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/schools?id=eq.${targetSchoolId}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            asaas_documents_status: status,
            asaas_verification_message: message,
            updated_at: new Date().toISOString(),
          }),
        });
      } catch (e) {
        console.error('[checkDocs] erro update:', e.message);
      }

      return res.status(200).json({
        status,
        message,
        general,
        documents: docsData?.data || [],
      });
    }
    // ── FIM HANDLER checkSchoolDocumentsStatus ─────────────────────────────────

    let asaasPath = '';
    let method = 'POST';
    let body = null;

    switch (action) {
      // ── SUBCONTAS (Split) ──────────────────────
      case 'createSubaccount':
        asaasPath = '/accounts';
        body = {
          name: data.name,
          cpfCnpj: (data.cpfCnpj || '').replace(/\D/g, ''),
          email: data.email,
          phone: data.phone ? data.phone.replace(/\D/g, '') : undefined,
          companyType: (data.cpfCnpj || '').replace(/\D/g, '').length > 11 ? 'ASSOCIATION' : 'MEI',
          incomeValue: data.incomeValue || 5000,
          postalCode: data.postalCode ? data.postalCode.replace(/\D/g, '') : undefined,
          address: data.address || undefined,
          addressNumber: data.addressNumber || undefined,
          complement: data.complement || undefined,
          province: data.province || undefined,
          city: data.city || undefined,
          state: data.state || undefined,
        };
        break;

      // ── COBRANÇAS PIX ──────────────────────────
      case 'createPixCharge': {
        // Asaas rejeita dueDate no passado — normaliza para hoje se necessário
        const hojeProxy = new Date().toISOString().slice(0, 10);
        const dueDateProxy = data.dueDate && data.dueDate >= hojeProxy ? data.dueDate : hojeProxy;

        // ── SPLIT CALCULADO NO SERVIDOR (nunca confiar no frontend) ──────────
        // Buscar commission_rate e asaas_wallet_id da escola no banco
        let serverSplit = undefined;
        if (userSchoolId && SUPABASE_SERVICE_KEY) {
          try {
            const schoolInfoRes = await fetch(
              `${SUPABASE_URL}/rest/v1/schools?id=eq.${userSchoolId}&select=commission_rate,asaas_wallet_id&limit=1`,
              { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
            );
            if (schoolInfoRes.ok) {
              const schoolInfo = await schoolInfoRes.json();
              const sc = schoolInfo?.[0];
              const grossValue   = Number(data.value) || 0;
              const ASAAS_FEE    = 1.99;
              const commRate     = Number(sc?.commission_rate ?? 3) / 100;
              const netAfterFee  = grossValue - ASAAS_FEE;
              const commission   = Number((netAfterFee * commRate).toFixed(2));
              const schoolGets   = Number((netAfterFee - commission).toFixed(2));

              if (schoolApiKey && GESTESCOLAR_WALLET_ID) {
                // Cobrança criada pela subconta da escola → GestEscolar recebe comissão via split
                if (commission > 0) {
                  serverSplit = [{ walletId: GESTESCOLAR_WALLET_ID, fixedValue: commission }];
                }
              } else if (!schoolApiKey && sc?.asaas_wallet_id) {
                // Cobrança criada pela conta mestre GestEscolar → escola recebe via split
                if (schoolGets > 0) {
                  serverSplit = [{ walletId: sc.asaas_wallet_id, fixedValue: schoolGets }];
                }
              }
            }
          } catch (splitErr) {
            console.warn('[createPixCharge] Erro ao calcular split no servidor:', splitErr.message);
            // fallback: usa split enviado pelo frontend
            serverSplit = data.split ? [(() => {
              const s = { walletId: data.split.walletId };
              if (data.split.fixedValue != null) s.fixedValue = data.split.fixedValue;
              return s;
            })()] : undefined;
          }
        }

        asaasPath = '/payments';
        body = {
          customer: data.customerId,
          billingType: 'PIX',
          value: data.value,
          dueDate: dueDateProxy,
          description: data.description,
          externalReference: data.externalReference,
          fine:     data.fine     ? { value: data.fine.value }     : undefined,
          interest: data.interest ? { value: data.interest.value } : undefined,
          split: serverSplit,
        };
        break;
      }

      // ── CRIAR CLIENTE NO ASAAS ─────────────────
      case 'createCustomer':
        asaasPath = '/customers';
        body = {
          name: data.name,
          cpfCnpj: (data.cpfCnpj || '').replace(/\D/g, ''),
          email: data.email,
          phone: data.phone ? data.phone.replace(/\D/g, '') : undefined,
          externalReference: data.externalReference,
        };
        break;

      // ── CONSULTAR COBRANÇA ─────────────────────
      case 'getPayment':
        asaasPath = `/payments/${data.paymentId}`;
        method = 'GET';
        break;

      // ── QR CODE PIX ────────────────────────────
      case 'getPixQrCode':
        asaasPath = `/payments/${data.paymentId}/pixQrCode`;
        method = 'GET';
        break;

      // ── CONSULTAR SALDO DA SUBCONTA ────────────
      // CRÍTICO: getBalance DEVE usar a API key da subconta da escola.
      // O guard SUBACCOUNT_ONLY_ACTIONS abaixo bloqueia se schoolApiKey for null.
      case 'getBalance':
        asaasPath = '/finance/balance';
        method = 'GET';
        break;

      // ── SOLICITAR SAQUE (TRANSFER) ─────────────
      case 'requestWithdraw':
        asaasPath = '/transfers';
        body = {
          value: data.value,
          bankAccount: data.bankAccount || undefined,
          pixAddressKey: data.pixKey,
          pixAddressKeyType: data.pixKeyType || 'EVP',
          operationType: 'PIX',
          description: data.description || 'Resgate GestEscolar',
        };
        break;

      // ── LISTAR TRANSFERÊNCIAS ──────────────────
      case 'listTransfers':
        asaasPath = `/transfers?offset=${data.offset || 0}&limit=${data.limit || 20}`;
        method = 'GET';
        break;

      // ── CONSULTAR SUBCONTA ─────────────────────
      case 'getSubaccount':
        asaasPath = `/accounts/${data.accountId}`;
        method = 'GET';
        break;

      // ── PLANOS SAAS: CRIAR CUSTOMER NA CONTA MASTER ───
      case 'createPlanCustomer':
        asaasPath = '/customers';
        body = {
          name:              data.name,
          cpfCnpj:          (data.cpfCnpj || '').replace(/\D/g, ''),
          email:             data.email,
          phone:             data.phone ? data.phone.replace(/\D/g, '') : undefined,
          externalReference: data.externalReference,
        };
        break;

      // ── PLANOS SAAS: ASSINATURA RECORRENTE MENSAL (cartão) ──
      case 'createPlanSubscription':
        asaasPath = '/subscriptions';
        body = {
          customer:          data.customerId,
          billingType:       'CREDIT_CARD',
          cycle:             'MONTHLY',
          value:             data.value,
          nextDueDate:       data.nextDueDate,
          description:       data.description,
          externalReference: data.externalReference,
          creditCard: {
            holderName:      data.card.holderName,
            number:          data.card.number.replace(/\s/g, ''),
            expiryMonth:     data.card.expiryMonth,
            expiryYear:      data.card.expiryYear,
            ccv:             data.card.ccv,
          },
          creditCardHolderInfo: {
            name:            data.card.holderName,
            email:           data.holderEmail,
            cpfCnpj:        (data.holderCpf || '').replace(/\D/g, ''),
            postalCode:     (data.holderPostalCode || '').replace(/\D/g, ''),
            addressNumber:   data.holderAddressNumber || 'S/N',
            phone:           data.holderPhone ? data.holderPhone.replace(/\D/g, '') : undefined,
          },
        };
        break;

      // ── PLANOS SAAS: COBRANÇA ÚNICA ANUAL (cartão) ────
      case 'createPlanCardPayment':
        asaasPath = '/payments';
        body = {
          customer:          data.customerId,
          billingType:       'CREDIT_CARD',
          value:             data.value,
          dueDate:           data.dueDate,
          description:       data.description,
          externalReference: data.externalReference,
          creditCard: {
            holderName:      data.card.holderName,
            number:          data.card.number.replace(/\s/g, ''),
            expiryMonth:     data.card.expiryMonth,
            expiryYear:      data.card.expiryYear,
            ccv:             data.card.ccv,
          },
          creditCardHolderInfo: {
            name:            data.card.holderName,
            email:           data.holderEmail,
            cpfCnpj:        (data.holderCpf || '').replace(/\D/g, ''),
            postalCode:     (data.holderPostalCode || '').replace(/\D/g, ''),
            addressNumber:   data.holderAddressNumber || 'S/N',
            phone:           data.holderPhone ? data.holderPhone.replace(/\D/g, '') : undefined,
          },
        };
        break;

      // ── PLANOS SAAS: PIX AVULSO (mensal ou anual) ──
      case 'createPlanPixPayment':
        asaasPath = '/payments';
        body = {
          customer:          data.customerId,
          billingType:       'PIX',
          value:             data.value,
          dueDate:           data.dueDate,
          description:       data.description,
          externalReference: data.externalReference,
        };
        break;

      // ── PLANOS SAAS: CONSULTAR ASSINATURA ──────────
      case 'getPlanSubscription':
        asaasPath = `/subscriptions/${data.subscriptionId}`;
        method = 'GET';
        break;

      // ── PLANOS SAAS: CANCELAR ASSINATURA ───────────
      case 'cancelPlanSubscription':
        asaasPath = `/subscriptions/${data.subscriptionId}`;
        method = 'DELETE';
        break;

      default:
        return res.status(400).json({ error: `Ação desconhecida: ${action}` });
    }

    // Determinar qual API key usar:
    // - Planos SaaS: sempre chave master
    // - refreshSubaccountApiKey: SEMPRE chave master (operação administrativa)
    // - Outras ações de subconta: chave da subconta buscada do servidor
    // Se o cliente sinalizar data.plan=true em getPixQrCode/getPayment, usa master key
    // (pagamentos de plano são criados com ASAAS_API_KEY master)
    const isPlanLookup = (action === 'getPixQrCode' || action === 'getPayment') && data?.plan === true;
    const isMasterAction = PLAN_ACTIONS.has(action) || isPlanLookup || action === 'refreshSubaccountApiKey';

    // CRÍTICO: ações que movimentam dinheiro da subconta NUNCA podem cair para a master key.
    // Sem isso, um saque com schoolApiKey=null sairia da conta da plataforma GestEscolar!
    const SUBACCOUNT_ONLY_ACTIONS = new Set([
      'requestWithdraw',
      'getBalance',
      'listTransfers',
    ]);
    if (SUBACCOUNT_ONLY_ACTIONS.has(action) && !schoolApiKey) {
      return res.status(403).json({
        error: 'Subconta Asaas não configurada para esta escola. Acesse Configurações → Documentos e envie os documentos KYC para ativar a subconta.',
        code: 'SUBACCOUNT_NOT_CONFIGURED',
      });
    }

    const apiKeyToUse = isMasterAction
      ? ASAAS_API_KEY
      : (schoolApiKey || ASAAS_API_KEY);

    const headers = {
      'Content-Type': 'application/json',
      'access_token': apiKeyToUse,
    };

    const fetchOpts = { method, headers };
    if (body && method !== 'GET') fetchOpts.body = JSON.stringify(body);

    const asaasRes = await fetch(`${ASAAS_BASE}${asaasPath}`, fetchOpts);

    // Parse JSON com segurança: Asaas pode retornar HTML em erros (404, auth, etc.)
    // asaasRes.json() lançaria SyntaxError causando 500 interno no proxy
    const rawText = await asaasRes.text();
    let asaasData = {};
    try {
      asaasData = JSON.parse(rawText);
    } catch (_) {
      console.error(`[Asaas] Resposta não-JSON (${asaasRes.status}): ${rawText.slice(0, 300)}`);
      return res.status(502).json({ error: `Resposta inválida do Asaas (HTTP ${asaasRes.status}).` });
    }

    if (!asaasRes.ok) {
      console.error('[Asaas Error]', action, asaasRes.status, JSON.stringify(asaasData));
      return res.status(asaasRes.status).json({
        error: asaasData.errors?.[0]?.description || asaasData.message || 'Erro na API Asaas.',
        asaasStatus: asaasRes.status,
      });
    }

    // ── IDOR: verificar propriedade do pagamento ───
    // Superadmin pode consultar qualquer pagamento; outros usuários só o da própria escola.
    if ((action === 'getPayment' || action === 'getPixQrCode') && userRole !== 'superadmin') {
      let ownershipOk = false;

      // Tentativa 1 (mais rápida): verificar via externalReference no formato schoolId|invoiceId
      // (cobranças geradas com o novo formato automaticamente passam aqui)
      if (!ownershipOk && userSchoolId) {
        let extRef = asaasData.externalReference || '';
        if (!extRef && action === 'getPixQrCode' && data.paymentId) {
          try {
            const payLookup = await fetch(`${ASAAS_BASE}/payments/${data.paymentId}`, {
              headers: { access_token: apiKeyToUse, 'Content-Type': 'application/json' },
            });
            if (payLookup.ok) {
              const payData = await payLookup.json();
              extRef = payData.externalReference || '';
            }
          } catch(_) {}
        }
        const refSchoolId = extRef.split('|')[0];
        if (refSchoolId && refSchoolId === String(userSchoolId)) ownershipOk = true;
      }

      // Tentativa 2 (qualquer role da escola): verifica pelo campo users.school_id
      if (!ownershipOk && data.paymentId && userSchoolId && SUPABASE_SERVICE_KEY) {
        try {
          const userRes = await fetch(
            `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${authUserId}&school_id=eq.${userSchoolId}&select=id&limit=1`,
            { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
          );
          if (userRes.ok) {
            const arr = await userRes.json();
            if (arr && arr[0]) {
              // Confirma que o paymentId existe nas invoices da escola
              const invRes = await fetch(
                `${SUPABASE_URL}/rest/v1/invoices?asaas_id=eq.${data.paymentId}&school_id=eq.${userSchoolId}&select=id&limit=1`,
                { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
              );
              if (invRes.ok) {
                const invData = await invRes.json();
                if (invData && invData[0]) ownershipOk = true;
              }
            }
          }
        } catch(_) {}
      }

      // Tentativa 3 (formato legado ou externalReference simples sem '|'):
      // verifica se o usuário pertence a QUALQUER escola que possui invoice com esse asaas_id
      if (!ownershipOk && data.paymentId && authUserId && SUPABASE_SERVICE_KEY) {
        try {
          const ownRes = await fetch(
            `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${authUserId}&select=school_id&limit=1`,
            { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
          );
          if (ownRes.ok) {
            const arr = await ownRes.json();
            if (arr && arr[0]?.school_id) {
              const sid = arr[0].school_id;
              const invRes2 = await fetch(
                `${SUPABASE_URL}/rest/v1/invoices?asaas_id=eq.${data.paymentId}&school_id=eq.${sid}&select=id&limit=1`,
                { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
              );
              if (invRes2.ok) {
                const invData2 = await invRes2.json();
                if (invData2 && invData2[0]) ownershipOk = true;
              }
            }
          }
        } catch(_) {}
      }

      if (!ownershipOk) {
        console.warn(`[Asaas IDOR] user ${authUserId} negado para paymentId=${data.paymentId}, userSchoolId=${userSchoolId}`);
        return res.status(403).json({ error: 'Acesso negado a este pagamento.' });
      }
    }

    // ── AUDIT LOG para ações sensíveis ─────────────
    if (AUDIT_ACTIONS.has(action)) {
      writeAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        userId: authUserId,
        schoolId: userSchoolId,
        action: `ASAAS_${action.toUpperCase()}`,
        ip,
        details: {
          asaasId: asaasData.id || asaasData.object,
          value:   data?.value,
          planId:  data?.externalReference,
        },
      });
    }

    return res.status(200).json(asaasData);
  } catch (err) {
    console.error('[Asaas Proxy Error]', err);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};
