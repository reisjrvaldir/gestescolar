// =============================================
//  GESTESCOLAR – Feriados (Calendário do Ano Letivo)
//  GET    /api/feriados?ano=2026          → lista feriados da escola
//  POST   /api/feriados                   → cria feriado (gestor)
//  DELETE /api/feriados?id=<uuid>         → remove feriado (gestor)
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

const TIPOS_VALIDOS = ['MUNICIPAL', 'ESTADUAL', 'IMPRENSADO', 'RECESSO'];

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

      const ano = req.query.ano ? parseInt(req.query.ano, 10) : null;
      let query = sb.from('feriados').select('*').eq('school_id', usuario.school_id);

      if (ano && !isNaN(ano)) {
        query = query
          .gte('data', `${ano}-01-01`)
          .lte('data', `${ano}-12-31`);
      }
      query = query.order('data', { ascending: true });

      const { data, error } = await query;
      if (error) throw new Error(`DB feriados list: ${error.message}`);
      return sucesso(res, data || []);
    }

    // ── POST ───────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      await exigirRole(Roles.GESTOR, Roles.SUPERADMIN)(usuario);

      const { data, descricao, tipo } = req.body || {};
      if (!data || !descricao) throw new AppError('Campos "data" e "descricao" são obrigatórios.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new AppError('Formato de data inválido (use YYYY-MM-DD).');

      const tipoFinal = tipo && TIPOS_VALIDOS.includes(tipo) ? tipo : 'MUNICIPAL';

      const { data: inserido, error } = await sb
        .from('feriados')
        .insert({
          school_id:  usuario.school_id,
          data,
          descricao:  descricao.trim().slice(0, 200),
          tipo:       tipoFinal,
          criado_por: usuario.id,
        })
        .select()
        .single();
      if (error) {
        if (error.code === '23505') throw new AppError('Já existe feriado nesta data.', 409, 'DUPLICADO');
        throw new Error(`DB feriados insert: ${error.message}`);
      }
      return criado(res, inserido);
    }

    // ── DELETE ─────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      await exigirRole(Roles.GESTOR, Roles.SUPERADMIN)(usuario);

      const id = req.query.id;
      if (!id) throw new AppError('Parâmetro "id" obrigatório.');

      const { error } = await sb
        .from('feriados')
        .delete()
        .eq('id', id)
        .eq('school_id', usuario.school_id);
      if (error) throw new Error(`DB feriados delete: ${error.message}`);
      return sucesso(res, { id, deleted: true });
    }

    return res.status(405).json({ ok: false, message: 'Método não permitido.' });

  } catch (err) {
    return erro(res, err);
  }
};
