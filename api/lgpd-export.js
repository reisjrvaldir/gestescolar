// =============================================
//  GESTESCOLAR – ENDPOINT LGPD EXPORT
//  Art. 18, V LGPD - Portabilidade de dados
//
//  Exporta TODOS os dados do titular em JSON estruturado.
//  Requer JWT do usuário (Authorization: Bearer ...).
// =============================================

/**
 * @typedef {import('../types/models').User} User
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FRONT_URL = process.env.FRONT_URL || '*';

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', FRONT_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Validar configuração
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[LGPD-Export] Variáveis de ambiente faltando');
    return res.status(500).json({ error: 'Configuração interna ausente.' });
  }

  // Validar autenticação (JWT do Supabase no header)
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Autenticação requerida.' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validar JWT e obter user
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const authUser = userData.user;
    const authId = authUser.id;
    const email = authUser.email;

    // Buscar dados do usuário no sistema
    const { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();

    if (appUserError) {
      console.error('[LGPD-Export] Erro ao buscar user:', appUserError);
      return res.status(500).json({ error: 'Erro ao buscar dados.' });
    }

    if (!appUser) {
      return res.status(404).json({ error: 'Usuário não encontrado no sistema.' });
    }

    // Montar export completo
    const exportData = {
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedBy: email,
        version: '1.0',
        legalBasis: 'Art. 18, V da Lei 13.709/2018 (LGPD)',
        retention: 'Dados fiscais (faturas) preservados por 5 anos conforme CTN.',
      },
      personalData: {
        id: appUser.id,
        name: appUser.name,
        email: appUser.email,
        phone: appUser.phone,
        cpf: appUser.cpf,
        role: appUser.role,
        createdAt: appUser.created_at,
        termsAcceptedAt: appUser.terms_accepted_at,
        privacyAcceptedAt: appUser.privacy_accepted_at,
        marketingOptIn: appUser.marketing_opt_in,
        marketingOptInAt: appUser.marketing_opt_in_at,
      },
      school: null,
      students: [],
      invoices: [],
      auditLogs: [],
    };

    // Se gestor/admin, incluir dados da escola
    if (['gestor', 'administrativo', 'financeiro'].includes(appUser.role) && appUser.school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('id, name, cnpj, email, phone, address, created_at, plan_id, school_status')
        .eq('id', appUser.school_id)
        .maybeSingle();
      if (school) exportData.school = school;

      // Faturas da escola
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, amount, due_date, status, paid_at, created_at')
        .eq('school_id', appUser.school_id)
        .limit(500);
      if (invoices) exportData.invoices = invoices;
    }

    // Se pai, incluir dados dos filhos vinculados
    if (appUser.role === 'pai' && appUser.school_id) {
      const { data: students } = await supabase
        .from('students')
        .select('id, name, birth_date, class_id')
        .eq('parent_id', appUser.id)
        .limit(50);
      if (students) exportData.students = students;
    }

    // Logs de auditoria do próprio usuário (últimos 100)
    try {
      const { data: logs } = await supabase
        .from('audit_log')
        .select('id, action, description, created_at')
        .or(`user_id.eq.${appUser.id},description.ilike.%${email}%`)
        .order('created_at', { ascending: false })
        .limit(100);
      if (logs) exportData.auditLogs = logs;
    } catch (_) { /* tabela audit_log pode não ter essas colunas em produção atual */ }

    // Registrar a exportação para auditoria
    try {
      await supabase.from('audit_log').insert({
        action: 'LGPD_DATA_EXPORT',
        description: `Exportação de dados solicitada por ${email}`,
        school_id: appUser.school_id || null,
        user_id: appUser.id,
        created_at: new Date().toISOString(),
      });
    } catch (_) {}

    return res.status(200).json({ ok: true, data: exportData });

  } catch (e) {
    console.error('[LGPD-Export] Erro:', e);
    return res.status(500).json({ error: 'Erro interno ao processar exportação.' });
  }
};
