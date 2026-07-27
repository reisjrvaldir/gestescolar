import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodTypeAny, ZodError } from 'zod';

/** Formato de erro retornado para o cliente. */
export interface ValidationErrorBody {
  code: 'validation';
  message: string;
  /** Mapa campo → mensagem. Chave vazia ('') = erro de nível raiz. */
  errors: Record<string, string>;
}

/**
 * Serializa todos os issues de um ZodError em um mapa campo → primeira mensagem.
 * Campos aninhados são achatados com ponto (ex.: guardian.cpf).
 */
function flattenErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_root';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Middleware que valida req.body com um schema Zod.
 * Em sucesso: sobrescreve req.body com parsed.data (campos extras removidos).
 * Em falha: retorna 400 com TODOS os erros de campo mapeados.
 */
export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = flattenErrors(result.error);
      const firstMsg = Object.values(errors)[0] ?? 'Dados inválidos';
      const body: ValidationErrorBody = {
        code: 'validation',
        message: firstMsg,
        errors,
      };
      res.status(400).json(body);
      return;
    }
    req.body = result.data;
    next();
  };
}
