// =============================================
//  GESTESCOLAR – Ausências / Lançamentos Manuais
//  GET    /api/ausencias?user_id=X&mes=5&ano=2026  → lista ausências
//  POST   /api/ausencias                           → cria/atualiza (gestor)
//  DELETE /api/ausencias?id=<uuid>                 → remove (gestor)
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

const TIPOS_VALIDOS = [
  'FALTA_JUSTIFICADA',
  'FALTA_INJUSTIFICADA',
  'ATESTADO_MEDICO',
  'DECLARACAO_MEDICA',
  'ABONADO',
];

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

      let query = sb.from('ausencias_ponto').select('*').eq('school_id', usuario.school_id);

      if (req.query.user_id) query = query.eq('user_id', req.query.user_id);

      if (req.query.mes && req.query.ano) {
        const mesNum = parseInt(req.query.mes, 10);
        const anoNum = parseInt(req.query.ano, 10);
        const mes    = String(mesNum).padStart(2, '0');
        // Último dia real do mês (evita "2026-04-31" que é inválido no PostgreSQL)
        const ultimoDia = new Date(anoNum, mesNum, 0).getDate();
        const dia       = String(ultimoDia).padStart(2, '0');
        query = query
          .gte('data', `${anoNum}-${mes}-01`)
          .lte('data', `${anoNum}-${mes}-${dia}`);
      }

      query = query.order('data', { ascending: true });

      const { data, error } = await query;
      if (error) throw new Error(`DB ausencias list: ${error.message}`);
      return sucesso(res, data || []);
    }

    // ── POST (upsert por user_id + data) ───────────────────────────────────
    if (req.method === 'POST') {
      await exigirRole(Roles.GESTOR, Roles.SUPERADMIN)(usuario);

      const b = req.body || {};
      if (!b.user_id) throw new AppError('Campo "user_id" obrigatório.');
      if (!b.data)    throw new AppError('Campo "data" obrigatório.');
      if (!b.tipo || !TIPOS_VALIDOS.includes(b.tipo))
        throw new AppError(`Tipo inválido. Aceitos: ${TIPOS_VALIDOS.join(', ')}`);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.data))
        throw new AppError('Formato de data inválido (use YYYY-MM-DD).');

      const payload = {
        user_id:        b.user_id,
        school_id:      usuario.school_id,
        data:           b.data,
        tipo:           b.tipo,
        periodo:        b.periodo || 'integral',
        horas_abonadas: parseFloat(b.horas_abonadas) || 0,
        observacao:     (b.observacao || '').trim().slice(0, 500) || null,
        registrado_por: usuario.id,
      };

      const { data, error } = await sb
        .from('ausencias_ponto')
        .upsert(payload, { onConflict: 'user_id,data' })
        .select()
        .single();
      if (error) throw new Error(`DB ausencias upsert: ${error.message}`);
      return criado(res, data);
    }

    // ── DELETE ─────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      await exigirRole(Roles.GESTOR, Roles.SUPERADMIN)(usuario);

      const id = req.query.id;
      if (!id) throw new AppError('Parâmetro "id" obrigatório.');

      const { error } = await sb
        .from('ausencias_ponto')
        .delete()
        .eq('id', id)
        .eq('school_id', usuario.school_id);
      if (error) throw new Error(`DB ausencias delete: ${error.message}`);
      return sucesso(res, { id, deleted: true });
    }

    return res.status(405).json({ ok: false, message: 'Método não permitido.' });

  } catch (err) {
    return erro(res, err);
  }
};
