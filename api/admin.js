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
  // Fluxo TOTALMENTE idempotente com service key (bypassa RLS).
  // Faz TUDO no backend para garantir consistência:
  //   1. Cria ou atualiza usuário no auth.users (com email_confirm:true)
  //   2. Sincroniza public.users.auth_id para bater com o real auth.users.id
  // Sem race condition entre operações no cliente.
  if (action === 'createAuthUser') {
    const caller = await getCallerInfo(authUserId);
    if (!caller || (caller.role !== 'gestor' && caller.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Permissão insuficiente.' });
    }

    const { email, password, name, role } = data || {};
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'email e senha (mín. 6 chars) obrigatórios.' });
    }
    const emailLower = email.toLowerCase();

    // 1. Tentar criar primeiro (caminho mais comum)
    let authId = null;
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailLower, password, email_confirm: true, user_metadata: { name, role } }),
    });
    const createBody = await createRes.json().catch(() => ({}));

    if (createRes.ok && createBody.id) {
      authId = createBody.id;
    } else {
      // 2. Falhou — provavelmente já existe. Listar e localizar por email.
      //    Lista até 1000 usuários (mais que suficiente para o caso de uso).
      let foundUser = null;
      let page = 1;
      while (!foundUser && page <= 10) {
        const listRes = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`,
          { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        const listBody = await listRes.json().catch(() => ({}));
        const users = listBody?.users || [];
        foundUser = users.find(u => u.email?.toLowerCase() === emailLower);
        if (users.length < 200) break; // última página
        page++;
      }

      if (!foundUser) {
        console.error('[Admin] createAuthUser: criação falhou e usuário não encontrado:', createBody);
        return res.status(500).json({ error: createBody.message || createBody.msg || 'Erro ao criar/localizar conta.' });
      }

      // Atualizar senha + confirmar e-mail
      const updRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${foundUser.id}`, {
        method: 'PUT',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, email_confirm: true }),
      });
      if (!updRes.ok) {
        const err = await updRes.json().catch(() => ({}));
        return res.status(updRes.status).json({ error: err.message || 'Erro ao atualizar conta existente.' });
      }
      authId = foundUser.id;
    }

    // 3. Sincronizar public.users.auth_id via service key (bypassa RLS)
    let publicUserSynced = false;
    let publicUserId = null;
    try {
      const findRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(emailLower)}&select=id,auth_id,active,school_id&limit=1`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      const users = await findRes.json().catch(() => []);
      const publicUser = Array.isArray(users) && users[0];
      if (publicUser) {
        publicUserId = publicUser.id;
        // Sempre força sync, mesmo que já bata (atualiza updated_at)
        if (publicUser.auth_id !== authId) {
          const syncRes = await fetch(
            `${SUPABASE_URL}/rest/v1/users?id=eq.${publicUser.id}`,
            {
              method: 'PATCH',
              headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({ auth_id: authId, active: true }),
            }
          );
          publicUserSynced = syncRes.ok;
          if (!syncRes.ok) {
            const errBody = await syncRes.json().catch(() => ({}));
            console.error('[Admin] PATCH public.users falhou:', syncRes.status, errBody);
          } else {
            console.log(`[Admin] auth_id sincronizado: ${publicUser.id} → ${authId}`);
          }
        } else {
          publicUserSynced = true; // já estava certo
        }
      }
    } catch (e) {
      console.error('[Admin] Falha ao sincronizar auth_id:', e.message);
    }

    // 4. Validação final: testa o login com a senha que acabou de ser setada
    //    Isso confirma que (a) a senha foi aplicada e (b) o e-mail está confirmado
    let loginVerified = false;
    let loginError = null;
    try {
      const testRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLower, password }),
      });
      if (testRes.ok) {
        loginVerified = true;
      } else {
        const testBody = await testRes.json().catch(() => ({}));
        loginError = testBody.error_description || testBody.msg || `HTTP ${testRes.status}`;
      }
    } catch (e) {
      loginError = e.message;
    }

    return res.status(200).json({
      ok: true,
      authId,
      diagnostics: {
        emailLower,
        publicUserId,
        publicUserSynced,
        loginVerified,
        loginError,
      },
    });
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
      if (!targetRes.ok) {
        return res.status(500).json({ error: 'Falha ao validar usuário-alvo.' });
      }
      const targets = await targetRes.json().catch(() => []);
      if (!Array.isArray(targets) || targets.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }
      const targetSchoolId = targets[0].school_id;
      if (!targetSchoolId || targetSchoolId !== caller.school_id) {
        return res.status(403).json({ error: 'Sem permissão para alterar senha de usuário de outra escola.' });
      }
    }

    // Reset de senha SEMPRE confirma o e-mail também — corrige contas legadas
    // criadas via signUp client-side que ficaram com email_confirmed_at=null
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password, email_confirm: true }),
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

  // ── deleteSchool: apenas superadmin ─────────────────────────────
  // Usa service key para bypass de RLS — seguro pois valida role server-side
  if (action === 'deleteSchool') {
    const caller = await getCallerInfo(authUserId);
    if (!caller || caller.role !== 'superadmin') {
      return res.status(403).json({ error: 'Apenas superadmin pode excluir escolas.' });
    }

    const { schoolId } = data || {};
    if (!schoolId || typeof schoolId !== 'string' || schoolId.length < 10) {
      return res.status(400).json({ error: 'schoolId inválido.' });
    }

    // Verificar que a escola existe antes de excluir
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/schools?id=eq.${schoolId}&select=id,name&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const schools = await checkRes.json().catch(() => []);
    if (!Array.isArray(schools) || schools.length === 0) {
      return res.status(404).json({ error: 'Escola não encontrada.' });
    }
    const schoolName = schools[0].name;

    // Excluir via service key — CASCADE apaga users, students, classes, invoices, etc.
    const delRes = await fetch(
      `${SUPABASE_URL}/rest/v1/schools?id=eq.${schoolId}`,
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: 'return=minimal',
        },
      }
    );

    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      console.error('[Admin] deleteSchool erro:', err);
      return res.status(delRes.status).json({ error: err.message || 'Erro ao excluir escola.' });
    }

    // Audit log da exclusão
    await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        school_id: null, // escola foi deletada
        action: 'SCHOOL_DELETED',
        details: JSON.stringify({
          deletedSchoolId: schoolId,
          deletedSchoolName: schoolName,
          deletedByAuthId: authUserId,
          deletedAt: new Date().toISOString(),
        }),
      }),
    }).catch(e => console.error('[Admin] Audit log deleteSchool:', e.message));

    console.log(`[Admin] Escola "${schoolName}" (${schoolId}) excluída por ${authUserId}`);
    return res.status(200).json({ ok: true, schoolName });
  }

  return res.status(400).json({ error: 'Ação desconhecida.' });
};
