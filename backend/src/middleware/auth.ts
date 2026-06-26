import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { pool, isDbConfigured } from '../db/pool';
import type { TenantContext } from '../db/withTenant';

// JWKS do Neon Auth (Better Auth) — cacheado pelo jose entre requests.
const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
const JWKS = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;

// O Neon Auth emite o JWT com iss/aud = ORIGEM (sem o path /neondb/auth).
const AUTH_ORIGIN =
  process.env.NEON_AUTH_ISSUER ||
  (process.env.NEON_AUTH_URL ? new URL(process.env.NEON_AUTH_URL).origin : undefined);

export interface AuthIdentity {
  authUserId: string;
  email?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: TenantContext;
      identity?: AuthIdentity;
    }
  }
}

/**
 * PONTO DE INTEGRAÇÃO NEON AUTH.
 * Valida o token e retorna a identidade do usuário.
 *
 * - DEV (AUTH_DEV_MODE=true): aceita o header `x-dev-user: <authUserId>`
 *   para permitir testar a API localmente sem o Neon Auth configurado.
 * - PROD: substituir pela verificação real do JWT/sessão do Neon Auth
 *   (assinatura/JWKS) assim que as chaves do projeto estiverem disponíveis.
 */
async function verifyAuthToken(req: Request): Promise<AuthIdentity | null> {
  if (process.env.AUTH_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production') {
    const devUser = req.header('x-dev-user');
    if (devUser) return { authUserId: devUser, email: req.header('x-dev-email') ?? undefined };
  }

  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  if (!JWKS) {
    throw Object.assign(new Error('NEON_AUTH_JWKS_URL não configurado'), { code: 'AUTH_NOT_CONFIGURED' });
  }

  // Verifica assinatura do JWT contra o JWKS do Neon Auth (Better Auth),
  // checando issuer e audience (ambos = origem do Neon Auth).
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: AUTH_ORIGIN,
    audience: AUTH_ORIGIN,
  });
  const authUserId = String(payload.sub ?? '');
  if (!authUserId) return null;
  const email = typeof payload.email === 'string' ? payload.email : undefined;
  return { authUserId, email };
}

/** Resolve school_id + role a partir do profile vinculado ao auth_user_id. */
async function resolveProfile(authUserId: string): Promise<TenantContext | null> {
  if (!isDbConfigured) return null;
  const { rows } = await pool.query(
    'select id, auth_user_id, school_id, role from public.profiles where auth_user_id = $1 limit 1',
    [authUserId],
  );
  if (rows.length === 0) return null;
  return { userId: rows[0].auth_user_id, profileId: rows[0].id, schoolId: rows[0].school_id, role: rows[0].role };
}

/** Middleware: exige JWT válido (identidade), mas NÃO exige perfil.
 *  Usado em /api/me e /api/onboarding (usuário recém-criado ainda sem perfil). */
export async function requireIdentity(req: Request, res: Response, next: NextFunction) {
  try {
    const identity = await verifyAuthToken(req);
    if (!identity) return res.status(401).json({ code: 'unauthorized', message: 'Token ausente ou inválido' });
    req.identity = identity;
    next();
  } catch (err: any) {
    const code = err?.code === 'AUTH_NOT_CONFIGURED' ? 'auth_not_configured' : 'unauthorized';
    res.status(401).json({ code, message: err?.message ?? 'Falha na autenticação' });
  }
}

/** Resolve o perfil (público) a partir de uma identidade já verificada. */
export { resolveProfile };

/** Middleware: exige usuário autenticado COM perfil; popula req.ctx. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const identity = await verifyAuthToken(req);
    if (!identity) return res.status(401).json({ code: 'unauthorized', message: 'Token ausente ou inválido' });

    req.identity = identity;
    const ctx = await resolveProfile(identity.authUserId);
    if (!ctx) return res.status(403).json({ code: 'no_profile', message: 'Usuário sem perfil vinculado' });

    req.ctx = ctx;
    next();
  } catch (err: any) {
    const code = err?.code === 'AUTH_NOT_CONFIGURED' ? 'auth_not_configured' : 'unauthorized';
    res.status(401).json({ code, message: err?.message ?? 'Falha na autenticação' });
  }
}

/** Middleware factory: exige um dos papéis informados. */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.ctx) return res.status(401).json({ code: 'unauthorized', message: 'Não autenticado' });
    if (!roles.includes(req.ctx.role)) {
      return res.status(403).json({ code: 'forbidden', message: 'Permissão insuficiente' });
    }
    next();
  };
}
