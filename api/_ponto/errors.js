// ─── ERROS DA APLICAÇÃO ───────────────────────────────────────────────────────

class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code       = code;
    this.name       = 'AppError';
  }
}

class NaoEncontradoError extends AppError {
  constructor(recurso = 'Recurso') {
    super(`${recurso} não encontrado.`, 404, 'NOT_FOUND');
  }
}

class NaoAutorizadoError extends AppError {
  constructor(msg = 'Não autorizado.') {
    super(msg, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(msg = 'Acesso negado.') {
    super(msg, 403, 'FORBIDDEN');
  }
}

class ConflitoPontoError extends AppError {
  constructor() {
    super('Já existe um registro de ponto nos últimos 60 segundos.', 409, 'DUPLICATE_PONTO');
  }
}

module.exports = { AppError, NaoEncontradoError, NaoAutorizadoError, ForbiddenError, ConflitoPontoError };
