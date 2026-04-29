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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
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
