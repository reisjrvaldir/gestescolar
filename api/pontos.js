// =============================================
//  GESTESCOLAR – Controle de Ponto Docente
//  GET  /api/pontos  → listar pontos
//  POST /api/pontos  → registrar ponto
// =============================================

const { extrairUsuario, Roles }      = require('./_ponto/auth');
const { validarCriarPonto, validarFiltros } = require('./_ponto/validacao');
const pontosService                  = require('./_ponto/pontos.service');
const { sucesso, criado, erro }      = require('./_ponto/resposta');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const usuario = await extrairUsuario(req);

    // ── GET /api/pontos ─────────────────────────────────────────────────────
    if (req.method === 'GET') {
      // Apenas gestor, admin e superadmin podem filtrar por qualquer user_id
      // Professor sempre recebe apenas os seus
      const filtros = validarFiltros(req.query);
      const resultado = await pontosService.listarPontos(filtros, usuario);

      return sucesso(res, {
        pontos: resultado.pontos,
        total:  resultado.total,
        page:   filtros.page,
        limit:  filtros.limit,
      });
    }

    // ── POST /api/pontos ────────────────────────────────────────────────────
    if (req.method === 'POST') {
      // Apenas professores registram ponto
      if (![Roles.PROFESSOR, Roles.GESTOR, Roles.SUPERADMIN].includes(usuario.role))
        return erro(res, { statusCode: 403, code: 'FORBIDDEN', message: 'Acesso negado.' });

      const dto   = validarCriarPonto(req.body);
      const ponto = await pontosService.criarPonto(dto, usuario.id);
      return criado(res, ponto);
    }

    return res.status(405).json({ ok: false, message: 'Método não permitido.' });

  } catch (err) {
    return erro(res, err);
  }
};
