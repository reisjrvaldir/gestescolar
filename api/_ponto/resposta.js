// ─── HELPERS DE RESPOSTA ──────────────────────────────────────────────────────

const { AppError } = require('./errors');

function sucesso(res, dados, statusCode = 200) {
  return res.status(statusCode).json({
    ok:   true,
    data: dados,
  });
}

function criado(res, dados) {
  return sucesso(res, dados, 201);
}

function erro(res, err) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok:      false,
      code:    err.code,
      message: err.message,
    });
  }

  console.error('[PontoDocente] Erro inesperado:', err);
  return res.status(500).json({
    ok:      false,
    code:    'INTERNAL_ERROR',
    message: 'Erro interno do servidor.',
  });
}

module.exports = { sucesso, criado, erro };
