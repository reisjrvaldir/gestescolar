// ─── REPOSITORY ───────────────────────────────────────────────────────────────
// Acesso direto ao Supabase. Sem lógica de negócio aqui.

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY; // service role para bypass RLS
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios.');
  return createClient(url, key);
}

// ─── PONTOS ───────────────────────────────────────────────────────────────────

async function inserirPonto(dados) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('pontos_docente')
    .insert(dados)
    .select()
    .single();
  if (error) throw new Error(`DB inserirPonto: ${error.message}`);
  return data;
}

async function buscarPontoPorId(id) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('pontos_docente')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`DB buscarPontoPorId: ${error.message}`);
  return data || null;
}

async function buscarUltimoPonto(user_id, janela_segundos = 60) {
  const sb = getSupabase();
  const desde = new Date(Date.now() - janela_segundos * 1000).toISOString();
  const { data, error } = await sb
    .from('pontos_docente')
    .select('id, timestamp, tipo')
    .eq('user_id', user_id)
    .gte('timestamp', desde)
    .order('timestamp', { ascending: false })
    .limit(1);
  if (error) throw new Error(`DB buscarUltimoPonto: ${error.message}`);
  return data?.[0] || null;
}

async function listarPontos(filtros) {
  const sb = getSupabase();
  let query = sb
    .from('pontos_docente')
    .select('*, users!user_id(name), ajustes_ponto(*)', { count: 'exact' });

  if (filtros.user_id)     query = query.eq('user_id', filtros.user_id);
  if (filtros.status)      query = query.eq('status', filtros.status);
  if (filtros.data_inicio) query = query.gte('timestamp', filtros.data_inicio);
  if (filtros.data_fim)    query = query.lte('timestamp', filtros.data_fim);

  const offset = (filtros.page - 1) * filtros.limit;
  query = query
    .order('timestamp', { ascending: false })
    .range(offset, offset + filtros.limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`DB listarPontos: ${error.message}`);

  // Achata user_name do join
  const pontos = (data || []).map(p => ({
    ...p,
    user_name: p.users?.name || p.user_id,
    users: undefined,
  }));
  return { pontos, total: count || 0 };
}

async function listarAjustes(filtros = {}) {
  const sb = getSupabase();
  let query = sb
    .from('ajustes_ponto')
    .select('*, pontos_docente!ponto_id(user_id, tipo, timestamp, users!user_id(name))', { count: 'exact' });

  if (filtros.status) query = query.eq('status', filtros.status);

  const limit  = filtros.limit  || 50;
  const page   = filtros.page   || 1;
  const offset = (page - 1) * limit;
  query = query
    .order('criado_em', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`DB listarAjustes: ${error.message}`);

  // Achata user_name do join aninhado
  const ajustes = (data || []).map(a => ({
    ...a,
    user_name: a.pontos_docente?.users?.name || null,
    ponto:     a.pontos_docente ? { user_id: a.pontos_docente.user_id, tipo: a.pontos_docente.tipo, timestamp: a.pontos_docente.timestamp } : null,
    pontos_docente: undefined,
  }));
  return { ajustes, total: count || 0 };
}

async function atualizarPonto(id, dados) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('pontos_docente')
    .update({ ...dados, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`DB atualizarPonto: ${error.message}`);
  return data;
}

// ─── AJUSTES ──────────────────────────────────────────────────────────────────

async function inserirAjuste(dados) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ajustes_ponto')
    .insert(dados)
    .select()
    .single();
  if (error) throw new Error(`DB inserirAjuste: ${error.message}`);
  return data;
}

async function buscarAjustePorId(id) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ajustes_ponto')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`DB buscarAjustePorId: ${error.message}`);
  return data || null;
}

async function atualizarAjuste(id, dados) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ajustes_ponto')
    .update(dados)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`DB atualizarAjuste: ${error.message}`);
  return data;
}

// ─── AUDITORIA ────────────────────────────────────────────────────────────────

async function inserirAuditoria(dados) {
  const sb = getSupabase();
  const { error } = await sb.from('auditoria_ponto').insert(dados);
  if (error) console.error(`[Auditoria] Erro ao registrar: ${error.message}`);
  // Auditoria nunca deve quebrar o fluxo principal
}

module.exports = {
  inserirPonto, buscarPontoPorId, buscarUltimoPonto, listarPontos, atualizarPonto,
  inserirAjuste, buscarAjustePorId, atualizarAjuste, listarAjustes,
  inserirAuditoria,
};
