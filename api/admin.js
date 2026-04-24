// =============================================
//  GESTESCOLAR – API ADMIN
//  Operações administrativas com service role
// =============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Busca role e school_id do usuário autenticado via service key
async function getCallerInfo(authUserId) {
  if (!authUserId || !SUPABASE_SERVICE_KEY) return null;
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${authUserId}&select=id,role,school_id&limit=1`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0] || null;
}

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://gestescolar.com.br';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[Admin] Configuração incompleta:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_SERVICE_KEY: !!SUPABASE_SERVICE_KEY });
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  // Valida token do requisitante
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente.' });
  }
  const token = authHeader.replace('Bearer ', '');

  // Verifica sessão no Supabase Auth
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SERVICE_KEY },
  });
  if (!authRes.ok) return res.status(401).json({ error: 'Sessão inválida.' });
  const authUser = await authRes.json();
  const authUserId = authUser?.id;

  const { action, data } = typeof req.body === 'string'
    ? JSON.parse(req.body)
    : (req.body || {});

  // ── createAuthUser: apenas gestor ou superadmin ──────────────────
  if (action === 'createAuthUser') {
    const caller = await getCallerInfo(authUserId);
    if (!caller || (caller.role !== 'gestor' && caller.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Permissão insuficiente.' });
    }

    const { email, password, name, role } = data || {};
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'email e senha (mín. 6 chars) obrigatórios.' });
    }
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name, role } }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: body.message || 'Erro ao criar usuário.' });
    return res.status(200).json({ ok: true, authId: body.id });
  }

  // ── updateUserPassword: apenas gestor (mesma escola) ou superadmin ──
  if (action === 'updateUserPassword') {
    const caller = await getCallerInfo(authUserId);
    if (!caller || (caller.role !== 'gestor' && caller.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Permissão insuficiente.' });
    }

    const { authId, password } = data || {};
    if (!authId || !password || password.length < 6) {
      return res.status(400).json({ error: 'authId e senha (mín. 6 caracteres) são obrigatórios.' });
    }

    // Verificar se o alvo pertence à mesma escola (anti-IDOR)
    if (caller.role !== 'superadmin') {
      const targetRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${authId}&select=school_id&limit=1`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      if (targetRes.ok) {
        const targets = await targetRes.json();
        const targetSchoolId = targets?.[0]?.school_id;
        if (targetSchoolId && targetSchoolId !== caller.school_id) {
          return res.status(403).json({ error: 'Sem permissão para alterar senha de usuário de outra escola.' });
        }
      }
    }

    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err.message || 'Erro ao atualizar senha.' });
    }

    return res.status(200).json({ ok: true });
  }

  // ── verifySuperAdmin: qualquer autenticado pode chamar (usado no login) ──
  if (action === 'verifySuperAdmin') {
    const { email: saEmail, authUid } = data || {};
    if (!saEmail) return res.status(400).json({ error: 'email obrigatório.' });

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(saEmail)}&role=eq.superadmin&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
      }
    );
    const rows = await r.json().catch(() => []);
    // Mensagem genérica para evitar oracle de enumeração
    if (!r.ok || !Array.isArray(rows) || rows.length === 0) {
      return res.status(403).json({ error: 'Credenciais inválidas.' });
    }

    const su = rows[0];

    // Vincular auth_id se ainda não tem
    if (authUid && !su.auth_id) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${su.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            apikey: SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ auth_id: authUid }),
        }
      );
    }

    // Retornar apenas campos necessários — nunca dados PII completos
    return res.status(200).json({
      ok: true,
      user: {
        id:      su.id,
        name:    su.name,
        email:   su.email,
        auth_id: su.auth_id || authUid,
        role:    su.role,
      },
    });
  }

  return res.status(400).json({ error: 'Ação desconhecida.' });
};
