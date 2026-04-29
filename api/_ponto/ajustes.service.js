// ─── SERVIÇO DE AJUSTES ───────────────────────────────────────────────────────

const repo          = require('./repository');
const auditoria     = require('./auditoria.service');
const pontosService = require('./pontos.service');
const { StatusAjuste, AcaoGestor } = require('./enums');
const { NaoEncontradoError, ForbiddenError } = require('./errors');

// ─── CRIAR AJUSTE ─────────────────────────────────────────────────────────────

async function criarAjuste(dto, userId) {
  const ponto = await repo.buscarPontoPorId(dto.ponto_id);
  if (!ponto) throw new NaoEncontradoError('Ponto');

  // Professor só pode ajustar os próprios pontos
  if (ponto.user_id !== userId) throw new ForbiddenError('Você só pode ajustar seus próprios registros.');

  const agora = new Date().toISOString();
  const ajuste = await repo.inserirAjuste({
    ponto_id:           dto.ponto_id,
    justificativa:      dto.justificativa,
    timestamp_ajustado: dto.timestamp_ajustado,
    status:             StatusAjuste.PENDENTE,
    criado_em:          agora,
  });

  await auditoria.registrar({
    ponto_id:            dto.ponto_id,
    acao:                'AJUSTE_SOLICITADO',
    usuario_responsavel: userId,
    dados_anteriores:    ponto,
    dados_novos:         ajuste,
  });

  return ajuste;
}

// ─── APROVAR / REJEITAR AJUSTE ────────────────────────────────────────────────

async function executarAcaoAjuste(ajusteId, dto, gestor) {
  const ajuste = await repo.buscarAjustePorId(ajusteId);
  if (!ajuste) throw new NaoEncontradoError('Ajuste');

  if (ajuste.status !== StatusAjuste.PENDENTE)
    throw new ForbiddenError(`Ajuste com status "${ajuste.status}" não pode ser alterado.`);

  const novoStatus = dto.acao === AcaoGestor.APROVAR
    ? StatusAjuste.APROVADO
    : StatusAjuste.REJEITADO;

  const ajusteAtualizado = await repo.atualizarAjuste(ajusteId, {
    status:        novoStatus,
    aprovado_por:  gestor.id,
  });

  await auditoria.registrar({
    ponto_id:            ajuste.ponto_id,
    acao:                dto.acao === AcaoGestor.APROVAR ? 'AJUSTE_APROVADO' : 'AJUSTE_REJEITADO',
    usuario_responsavel: gestor.id,
    dados_anteriores:    ajuste,
    dados_novos:         ajusteAtualizado,
  });

  // Se aprovado, aplica o ajuste no ponto original
  if (dto.acao === AcaoGestor.APROVAR) {
    const pontoOriginal = await repo.buscarPontoPorId(ajuste.ponto_id);
    await pontosService.aplicarAjuste(ajusteAtualizado, pontoOriginal, gestor);
  }

  return ajusteAtualizado;
}

// ─── LISTAR AJUSTES ───────────────────────────────────────────────────────────

async function listarAjustes(filtros) {
  return repo.listarAjustes(filtros);
}

module.exports = { criarAjuste, executarAcaoAjuste, listarAjustes };
