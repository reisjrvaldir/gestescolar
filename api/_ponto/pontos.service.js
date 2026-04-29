// ─── SERVIÇO DE PONTOS ────────────────────────────────────────────────────────

const repo       = require('./repository');
const auditoria  = require('./auditoria.service');
const { StatusPonto, StatusAjuste, AcaoGestor } = require('./enums');
const { ConflitoPontoError, NaoEncontradoError, ForbiddenError } = require('./errors');

// ─── CRIAR PONTO ──────────────────────────────────────────────────────────────

async function criarPonto(dto, userId) {
  // 1. Bloquear registros duplicados (janela de 60s)
  const recente = await repo.buscarUltimoPonto(userId, 60);
  if (recente) throw new ConflitoPontoError();

  // 2. Timestamp SEMPRE gerado no servidor
  const agora = new Date().toISOString();

  // 3. Status baseado em device_id
  const status = dto.device_id ? StatusPonto.AUTO_VALIDADO : StatusPonto.PENDENTE;

  // 4. Persistir
  const ponto = await repo.inserirPonto({
    user_id:    userId,
    tipo:       dto.tipo,
    timestamp:  agora,
    descricao:  dto.descricao,
    device_id:  dto.device_id,
    status,
    criado_em:  agora,
    atualizado_em: agora,
  });

  // 5. Auditoria
  await auditoria.registrar({
    ponto_id:             ponto.id,
    acao:                 'PONTO_CRIADO',
    usuario_responsavel:  userId,
    dados_anteriores:     null,
    dados_novos:          ponto,
  });

  return ponto;
}

// ─── LISTAR PONTOS ────────────────────────────────────────────────────────────

async function listarPontos(filtros, user) {
  // Professor só vê os próprios pontos
  if (user.role === 'professor') {
    filtros.user_id = user.id;
  }
  return repo.listarPontos(filtros);
}

// ─── APROVAR / REJEITAR ───────────────────────────────────────────────────────

async function executarAcao(pontoId, dto, gestor) {
  const ponto = await repo.buscarPontoPorId(pontoId);
  if (!ponto) throw new NaoEncontradoError('Ponto');

  if (![StatusPonto.PENDENTE, StatusPonto.AUTO_VALIDADO].includes(ponto.status))
    throw new ForbiddenError(`Ponto com status "${ponto.status}" não pode ser alterado.`);

  const novoStatus = dto.acao === AcaoGestor.APROVAR
    ? StatusPonto.APROVADO
    : StatusPonto.REJEITADO;

  const pontoAtualizado = await repo.atualizarPonto(pontoId, {
    status:    novoStatus,
    descricao: dto.observacao ? `${ponto.descricao || ''}\n[Gestor]: ${dto.observacao}`.trim() : ponto.descricao,
  });

  await auditoria.registrar({
    ponto_id:            pontoId,
    acao:                dto.acao === AcaoGestor.APROVAR ? 'PONTO_APROVADO' : 'PONTO_REJEITADO',
    usuario_responsavel: gestor.id,
    dados_anteriores:    ponto,
    dados_novos:         pontoAtualizado,
  });

  return pontoAtualizado;
}

// ─── PROCESSAR AJUSTE APROVADO ────────────────────────────────────────────────

async function aplicarAjuste(ajuste, pontoOriginal, gestor) {
  const pontoAtualizado = await repo.atualizarPonto(ajuste.ponto_id, {
    timestamp: ajuste.timestamp_ajustado,
    status:    StatusPonto.APROVADO,
  });

  await auditoria.registrar({
    ponto_id:            ajuste.ponto_id,
    acao:                'AJUSTE_APLICADO',
    usuario_responsavel: gestor.id,
    dados_anteriores:    pontoOriginal,
    dados_novos:         pontoAtualizado,
  });

  return pontoAtualizado;
}

module.exports = { criarPonto, listarPontos, executarAcao, aplicarAjuste };
