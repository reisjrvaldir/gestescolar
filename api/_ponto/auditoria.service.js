// ─── SERVIÇO DE AUDITORIA ─────────────────────────────────────────────────────

const repo = require('./repository');

async function registrar({ ponto_id, acao, usuario_responsavel, dados_anteriores = null, dados_novos = null }) {
  await repo.inserirAuditoria({
    ponto_id,
    acao,
    usuario_responsavel,
    dados_anteriores: dados_anteriores ? JSON.stringify(dados_anteriores) : null,
    dados_novos:      dados_novos      ? JSON.stringify(dados_novos)      : null,
    criado_em:        new Date().toISOString(),
  });
}

module.exports = { registrar };
