// =============================================
//  GESTESCOLAR – Controle de Ponto Docente
//  POST /api/pontos-ajuste          → solicitar ajuste (professor)
//  POST /api/pontos-ajuste?id=<id>  → aprovar/rejeitar ajuste (gestor)
// =============================================

const { extrairUsuario, exigirRole, Roles } = require('./_ponto/auth');
const { validarCriarAjuste, validarAcaoPonto } = require('./_ponto/validacao');
const ajustesService                          = require('./_ponto/ajustes.service');
const { sucesso, criado, erro }               = require('./_ponto/resposta');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET /api/pontos-ajuste → gestor lista ajustes ──────────────────────────
  if (req.method === 'GET') {
    try {
      const usuario = await extrairUsuario(req);
      await exigirRole(Roles.GESTOR, Roles.SUPERADMIN)(usuario);
      const filtros = {
        status: req.query.status || '',
        limit:  Math.min(parseInt(req.query.limit  || '50', 10), 100),
        page:   Math.max(parseInt(req.query.page   || '1',  10), 1),
      };
      const resultado = await ajustesService.listarAjustes(filtros);
      return sucesso(res, resultado.ajustes);
    } catch (err) {
      return erro(res, err);
    }
  }

  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, message: 'Método não permitido.' });

  try {
    const usuario  = await extrairUsuario(req);
    const ajusteId = req.query.id;

    // ── Com ?id= → gestor aprova/rejeita ajuste ─────────────────────────────
    if (ajusteId) {
      await exigirRole(Roles.GESTOR, Roles.SUPERADMIN)(usuario);
      const dto             = validarAcaoPonto(req.body);
      const ajusteAtualizado = await ajustesService.executarAcaoAjuste(ajusteId, dto, usuario);
      return sucesso(res, ajusteAtualizado);
    }

    // ── Sem ?id= → professor solicita ajuste ────────────────────────────────
    await exigirRole(Roles.PROFESSOR, Roles.GESTOR, Roles.SUPERADMIN)(usuario);
    const dto    = validarCriarAjuste(req.body);
    const ajuste = await ajustesService.criarAjuste(dto, usuario.id);
    return criado(res, ajuste);

  } catch (err) {
    return erro(res, err);
  }
};
