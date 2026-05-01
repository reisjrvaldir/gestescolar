// =============================================
//  GESTESCOLAR – Jornadas dos Professores
//  GET    /api/jornadas                 → lista jornadas da escola (gestor)
//  GET    /api/jornadas?user_id=<uuid>  → jornada de um professor
//  POST   /api/jornadas                 → cria/atualiza jornada (gestor)
//  DELETE /api/jornadas?id=<uuid>       → remove jornada (gestor)
// =============================================

const { createClient } = require('@supabase/supabase-js');
const { extrairUsuario, exigirRole, Roles } = require('./_ponto/auth');
const { sucesso, criado, erro } = require('./_ponto/resposta');
const { AppError } = require('./_ponto/errors');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios.');
  return createClient(url, key);
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function validarHora(h, campo) {
  if (!h) return null;
  if (!HHMM.test(h)) throw new AppError(`Campo "${campo}" deve estar no formato HH:MM.`);
  return h.length === 5 ? `${h}:00` : h;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const usuario = await extrairUsuario(req);
    const sb      = getSupabase();

    // ── GET ────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (!usuario.school_id) return sucesso(res, []);

      const userId = req.query.user_id;
      let query = sb.from('professor_jornadas').select('*').eq('school_id', usuario.school_id);

      if (userId) {
        query = query.eq('user_id', userId);
        const { data, error } = await query.maybeSingle();
        if (error) throw new Error(`DB jornadas get: ${error.message}`);
        return sucesso(res, data || null);
      }

      const { data, error } = await query.order('criado_em', { ascending: false });
      if (error) throw new Error(`DB jornadas list: ${error.message}`);
      return sucesso(res, data || []);
    }

    // ── POST (upsert por user_id) ──────────────────────────────────────────
    if (req.method === 'POST') {
      await exigirRole(Roles.GESTOR, Roles.SUPERADMIN)(usuario);

      const b = req.body || {};
      if (!b.user_id) throw new AppError('Campo "user_id" obrigatório.');

      // Verifica se o user existe e é professor da mesma escola
      const { data: prof, error: errProf } = await sb
        .from('users')
        .select('id, role, school_id')
        .eq('id', b.user_id)
        .single();
      if (errProf || !prof) throw new AppError('Professor não encontrado.', 404);
      if (prof.school_id !== usuario.school_id) throw new AppError('Professor de outra escola.', 403);
      if (prof.role !== 'professor') throw new AppError('Usuário não é professor.', 400);

      const payload = {
        user_id:    b.user_id,
        school_id:  usuario.school_id,
        trabalha_seg: !!b.trabalha_seg,
        trabalha_ter: !!b.trabalha_ter,
        trabalha_qua: !!b.trabalha_qua,
        trabalha_qui: !!b.trabalha_qui,
        trabalha_sex: !!b.trabalha_sex,
        trabalha_sab: !!b.trabalha_sab,
        trabalha_dom: !!b.trabalha_dom,
        periodo1_entrada: validarHora(b.periodo1_entrada, 'periodo1_entrada'),
        periodo1_saida:   validarHora(b.periodo1_saida,   'periodo1_saida'),
        periodo2_entrada: validarHora(b.periodo2_entrada, 'periodo2_entrada'),
        periodo2_saida:   validarHora(b.periodo2_saida,   'periodo2_saida'),
        intervalo_minutos:     parseInt(b.intervalo_minutos, 10) || 0,
        carga_horaria_semanal: parseFloat(b.carga_horaria_semanal),
        tolerancia_minutos:    parseInt(b.tolerancia_minutos, 10) || 15,
      };

      if (!payload.periodo1_entrada || !payload.periodo1_saida) {
        throw new AppError('Período 1 (entrada e saída) é obrigatório.');
      }
      if (!payload.carga_horaria_semanal || payload.carga_horaria_semanal <= 0) {
        throw new AppError('Carga horária semanal deve ser maior que zero.');
      }
      const algumDia = ['seg','ter','qua','qui','sex','sab','dom'].some(d => payload[`trabalha_${d}`]);
      if (!algumDia) throw new AppError('Selecione pelo menos um dia da semana.');

      // UPSERT por user_id
      const { data, error } = await sb
        .from('professor_jornadas')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw new Error(`DB jornadas upsert: ${error.message}`);
      return criado(res, data);
    }

    // ── DELETE ─────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      await exigirRole(Roles.GESTOR, Roles.SUPERADMIN)(usuario);

      const id = req.query.id;
      if (!id) throw new AppError('Parâmetro "id" obrigatório.');

      const { error } = await sb
        .from('professor_jornadas')
        .delete()
        .eq('id', id)
        .eq('school_id', usuario.school_id);
      if (error) throw new Error(`DB jornadas delete: ${error.message}`);
      return sucesso(res, { id, deleted: true });
    }

    return res.status(405).json({ ok: false, message: 'Método não permitido.' });

  } catch (err) {
    return erro(res, err);
  }
};
