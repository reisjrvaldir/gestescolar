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

// Supabase server-side para validar sessão
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Ações que só gestores/superadmin podem executar
const GESTOR_ONLY_ACTIONS = new Set([
  'createSubaccount', 'requestWithdraw', 'getBalance',
  'listTransfers', 'getSubaccount', 'refreshSubaccountApiKey',
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
    const PUBLIC_ACTIONS = new Set(['signupAndBootstrap', 'sendPasswordRecovery', 'resetPasswordWithToken']);

    // ── RECUPERAÇÃO DE SENHA PÚBLICA (login page) ─────────
    // Gera um link de reset via Supabase Admin e envia via Resend
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

      // Gerar token de reset customizado (UUID)
      const cryptoNode = require('crypto');
      const resetToken = cryptoNode.randomUUID();
      const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hora

      // Hashear token antes de armazenar (segurança)
      const tokenHash = cryptoNode.createHash('sha256').update(resetToken).digest('hex');

      console.log('[Password Recovery] Gerando token de reset para:', email);

      // Construir link com token no fragment (#) para não enviar ao servidor
      // Frontend extrai parâmetros de getHashParams() que procura no fragment
      const resetLink = `${process.env.ALLOWED_ORIGIN || 'https://gestescolar.com.br'}/login#reset_token=${resetToken}&reset_email=${encodeURIComponent(email)}`;

      console.log('[Password Recovery] Link de reset gerado:', resetLink.slice(0, 100) + '...');

      // Enviar via Resend
      console.log('[Password Recovery] Enviando email via Resend para:', email);
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'suporte@gestescolar.com.br',
          to: email,
          subject: 'Recuperação de Senha - GestEscolar 🔐',
          html: `
<html>
<head><meta charset="UTF-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;}
.container{max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9;}
.header{background:linear-gradient(135deg,#1976d2,#1565c0);color:#fff;padding:30px;border-radius:8px 8px 0 0;text-align:center;}
.content{background:#fff;padding:30px;border-radius:0 0 8px 8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);}
.warning{background:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:20px 0;border-radius:4px;}
.button{display:inline-block;background:#1976d2;color:#fff;padding:12px 30px;text-decoration:none;border-radius:6px;margin:20px 0;font-weight:600;}
.footer{margin-top:30px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#666;text-align:center;}
</style></head>
<body>
<div class="container">
<div class="header"><h1>🎓 GestEscolar</h1><p>Recuperação de Senha</p></div>
<div class="content">
<p>Recebemos uma solicitação para recuperar sua senha.</p>
<div class="warning"><strong>⏰ Link válido por 1 hora</strong><br>Se você não solicitou, ignore este email.</div>
<p>Clique no botão para criar uma nova senha:</p>
<a href="${resetLink}" class="button">Recuperar Senha</a>
<p style="font-size:13px;color:#666;">Ou copie: <span style="word-break:break-all;font-size:12px;">${resetLink}</span></p>
<div class="footer"><p>Dúvidas? suporte@gestescolar.com.br</p></div>
</div>
</div>
</body>
</html>`,
          replyTo: 'suporte@gestescolar.com.br',
        }),
      });

      const emailData = await emailRes.json();
      console.log('[Password Recovery] Resend response:', emailRes.status, JSON.stringify(emailData).slice(0, 200));
      if (!emailRes.ok) {
        console.error('[Resend] Error enviando email:', emailRes.status, emailData);
        // Email falhou, retorna o erro
        return res.status(500).json({ error: `Erro ao enviar email: ${emailData.message || emailData.error || 'desconhecido'}` });
      }

      console.log('[Password Recovery] ✅ Email enviado com sucesso para', email, 'ID:', emailData.id);

      // Armazenar token HASHEADO para validação posterior (segurança)
      try {
        const supabaseAdmin = require('@supabase/supabase-js').createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Verificar se tabela existe antes de inserir
        const { error: checkError } = await supabaseAdmin
          .from('password_reset_tokens')
          .select('id')
          .limit(1);

        if (checkError?.code === 'PGRST116') {
          console.error('[Password Recovery] ❌ ERRO CRÍTICO: Tabela password_reset_tokens não existe. Crie a tabela no Supabase:');
          console.error('CREATE TABLE password_reset_tokens (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, email TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT now());');
          return res.status(500).json({ error: 'Serviço de recuperação de senha indisponível. Contate o administrador.' });
        }

        // Tentar armazenar com novo schema (token_hash) primeiro
        let insertResult = await supabaseAdmin.from('password_reset_tokens').insert({
          email: email,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        });

        // Se falhar porque coluna token_hash não existe, usar schema legado (token)
        if (insertResult.error && (insertResult.error.code === 'PGRST204' || insertResult.error.message?.includes('token_hash'))) {
          console.warn('[Password Recovery] Coluna token_hash não existe, usando schema legado (token plain)');
          insertResult = await supabaseAdmin.from('password_reset_tokens').insert({
            email: email,
            token: resetToken,  // Schema antigo: armazena em plain text
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
          });
        }

        if (insertResult.error) {
          console.error('[Password Recovery] Erro ao inserir token:', insertResult.error);
          return res.status(500).json({ error: 'Erro ao processar recuperação de senha. Tente novamente em alguns minutos.' });
        }

        console.log('[Password Recovery] ✅ Token armazenado com segurança em password_reset_tokens');
      } catch (e) {
        console.error('[Password Recovery] ❌ Falha ao armazenar token:', e.message);
        return res.status(500).json({ error: 'Erro ao processar recuperação de senha. Tente novamente em alguns minutos.' });
      }

      return res.status(200).json({ success: true, message: 'Email de recuperação enviado' });
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
      const schoolRow = {
        id: schoolId, name: s.name, cnpj: s.cnpj || null, phone: s.phone || null,
        email: s.email || email, plan_id: s.planId || 'free',
        postal_code: s.postalCode || null, address: s.address || null,
        address_number: s.addressNumber || null, complement: s.complement || null,
        city: s.city || null, state: s.state || null,
        owner_id: userId, status: 'trial',
        school_status: 'trial', trial_started_at: now, created_at: now,
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
            // Procurar token matching - tenta novo schema (token_hash) E schema antigo (token)
            for (const t of tokens) {
              // Schema novo: token_hash (SHA256)
              if (t.token_hash && t.token_hash === tokenHash) {
                console.log('[Password Reset] Token encontrado via token_hash (schema novo)');
                tokenData = t;
                break;
              }
              // Schema antigo: token (plain text)
              if (t.token && t.token === resetToken) {
                console.log('[Password Reset] Token encontrado via token plain (schema legado)');
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
          split: data.split ? [
            (() => {
              const s = { walletId: data.split.walletId };
              if (data.split.percentualValue != null) s.percentualValue = data.split.percentualValue;
              else if (data.split.fixedValue != null) s.fixedValue = data.split.fixedValue;
              return s;
            })()
          ] : undefined,
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
      // Sem schoolApiKey, retornaria o saldo da conta principal (master) — proibido.
      case 'getBalance':
        if (!schoolApiKey) {
          console.warn(`[getBalance] Escola ${userSchoolId} sem asaas_sub_api_key — retornando saldo zero.`);
          return res.status(200).json({
            balance: 0,
            totalBalance: 0,
            warning: 'Subconta Asaas não configurada para esta escola. Crie a subconta no painel ou contate o suporte.',
          });
        }
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

      // ── GERAR/RECUPERAR API KEY DA SUBCONTA (usa chave master) ──
      // Necessário quando escola foi criada sem salvar asaasSubApiKey
      case 'refreshSubaccountApiKey':
        asaasPath = `/accounts/api_key/${data.accountId}`;
        method = 'POST';
        body = {}; // POST sem body gera/regenera a API key
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
    // - Outras ações: chave da subconta buscada do servidor (nunca do cliente)
    // Se o cliente sinalizar data.plan=true em getPixQrCode/getPayment, usa master key
    // (pagamentos de plano são criados com ASAAS_API_KEY master)
    const isPlanLookup = (action === 'getPixQrCode' || action === 'getPayment') && data?.plan === true;
    const isMasterAction = PLAN_ACTIONS.has(action) || isPlanLookup || action === 'refreshSubaccountApiKey';
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
    const asaasData = await asaasRes.json();

    if (!asaasRes.ok) {
      console.error('[Asaas Error]', asaasRes.status, JSON.stringify(asaasData));
      return res.status(asaasRes.status).json({
        error: asaasData.errors?.[0]?.description || asaasData.message || 'Erro na API Asaas.',
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
