// =============================================
//  GESTESCOLAR – Controle de Ponto Docente
//  POST /api/pontos-acao?id=<ponto_id>
//  Aprovar / Rejeitar um registro de ponto
//  Acesso: gestor, superadmin
// =============================================

const { extrairUsuario, exigirRole, Roles } = require('./_ponto/auth');
const { validarAcaoPonto }                  = require('./_ponto/validacao');
const pontosService                         = require('./_ponto/pontos.service');
const { sucesso, erro }                     = require('./_ponto/resposta');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, message: 'Método não permitido.' });

  try {
    const usuario = await extrairUsuario(req);
    await exigirRole(Roles.GESTOR, Roles.SUPERADMIN)(usuario);

    const pontoId = req.query.id;
    if (!pontoId)
      return res.status(400).json({ ok: false, message: 'Parâmetro "id" é obrigatório.' });

    const dto             = validarAcaoPonto(req.body);
    const pontoAtualizado = await pontosService.executarAcao(pontoId, dto, usuario);

    return sucesso(res, pontoAtualizado);

  } catch (err) {
    return erro(res, err);
  }
};
