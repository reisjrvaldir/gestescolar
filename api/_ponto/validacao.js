// ─── VALIDAÇÃO DE DTOs ────────────────────────────────────────────────────────

const { TipoPonto, AcaoGestor } = require('./enums');
const { AppError } = require('./errors');

function validarCriarPonto(body) {
  const { tipo, descricao, device_id } = body || {};

  if (!tipo) throw new AppError('Campo "tipo" é obrigatório.');
  if (!Object.values(TipoPonto).includes(tipo))
    throw new AppError(`Tipo inválido. Valores aceitos: ${Object.values(TipoPonto).join(', ')}`);

  if (descricao !== undefined && typeof descricao !== 'string')
    throw new AppError('Campo "descricao" deve ser texto.');

  if (descricao && descricao.length > 500)
    throw new AppError('Campo "descricao" deve ter no máximo 500 caracteres.');

  // BLOQUEAR qualquer tentativa de envio de timestamp pelo cliente
  if (body.timestamp || body.criado_em || body.created_at || body.data || body.hora)
    throw new AppError('Não é permitido enviar data/hora manual. O timestamp é gerado pelo servidor.', 400, 'TIMESTAMP_PROIBIDO');

  return {
    tipo,
    descricao: descricao?.trim() || null,
    device_id: device_id?.trim() || null,
  };
}

function validarCriarAjuste(body) {
  const { ponto_id, justificativa, timestamp_ajustado } = body || {};

  if (!ponto_id)        throw new AppError('Campo "ponto_id" é obrigatório.');
  if (!justificativa)   throw new AppError('Campo "justificativa" é obrigatório.');
  if (typeof justificativa !== 'string') throw new AppError('"justificativa" deve ser texto.');
  if (justificativa.trim().length < 10)  throw new AppError('"justificativa" deve ter pelo menos 10 caracteres.');
  if (justificativa.length > 1000)       throw new AppError('"justificativa" deve ter no máximo 1000 caracteres.');
  if (!timestamp_ajustado)               throw new AppError('Campo "timestamp_ajustado" é obrigatório.');

  const ts = new Date(timestamp_ajustado);
  if (isNaN(ts.getTime())) throw new AppError('"timestamp_ajustado" deve ser uma data/hora válida.');
  if (ts > new Date())     throw new AppError('"timestamp_ajustado" não pode ser no futuro.');

  return {
    ponto_id,
    justificativa: justificativa.trim(),
    timestamp_ajustado: ts.toISOString(),
  };
}

function validarAcaoPonto(body) {
  const { acao, observacao } = body || {};

  if (!acao) throw new AppError('Campo "acao" é obrigatório.');
  if (!Object.values(AcaoGestor).includes(acao))
    throw new AppError(`Ação inválida. Valores aceitos: ${Object.values(AcaoGestor).join(', ')}`);

  if (observacao && typeof observacao !== 'string')
    throw new AppError('"observacao" deve ser texto.');

  return {
    acao,
    observacao: observacao?.trim() || null,
  };
}

function validarFiltros(query) {
  const { user_id, status, data_inicio, data_fim, page = '1', limit = '50' } = query || {};

  const filtros = {};

  if (user_id)    filtros.user_id    = user_id;
  if (status)     filtros.status     = status;

  if (data_inicio) {
    const d = new Date(data_inicio);
    if (isNaN(d.getTime())) throw new AppError('"data_inicio" inválida.');
    filtros.data_inicio = d.toISOString();
  }
  if (data_fim) {
    const d = new Date(data_fim);
    if (isNaN(d.getTime())) throw new AppError('"data_fim" inválida.');
    filtros.data_fim = d.toISOString();
  }

  filtros.page  = Math.max(1, parseInt(page)  || 1);
  filtros.limit = Math.min(100, Math.max(1, parseInt(limit) || 50));

  return filtros;
}

module.exports = { validarCriarPonto, validarCriarAjuste, validarAcaoPonto, validarFiltros };
