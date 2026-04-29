// ─── AUTENTICAÇÃO / EXTRAÇÃO DO USUÁRIO ───────────────────────────────────────
// Reutiliza o padrão já existente no projeto (Supabase JWT)

const { createClient } = require('@supabase/supabase-js');
const { NaoAutorizadoError, ForbiddenError } = require('./errors');

async function extrairUsuario(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw new NaoAutorizadoError('Token não informado.');

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );

  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new NaoAutorizadoError('Token inválido ou expirado.');

  // Busca dados do usuário no banco (role, escola, etc.)
  const sbSvc = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data: perfil } = await sbSvc
    .from('users')
    .select('id, name, role, school_id')
    .eq('auth_id', user.id)
    .single();

  if (!perfil) throw new NaoAutorizadoError('Usuário não encontrado no sistema.');

  return {
    id:        perfil.id,
    authId:    user.id,
    name:      perfil.name,
    role:      perfil.role,
    school_id: perfil.school_id,
  };
}

function exigirRole(...roles) {
  return async (usuario) => {
    if (!roles.includes(usuario.role))
      throw new ForbiddenError(`Acesso restrito a: ${roles.join(', ')}.`);
  };
}

const Roles = {
  GESTOR:     'admin',
  PROFESSOR:  'professor',
  SUPERADMIN: 'superadmin',
};

module.exports = { extrairUsuario, exigirRole, Roles };
