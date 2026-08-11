import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isDbConfigured } from '../../db/pool';
import { withSystem } from '../../db/withTenant';

export const publicAuthRouter = Router();

const GENERIC_ERROR = 'Não foi possível entrar. Verifique os dados ou procure a escola.';

// Mínimo de 300 ms por resposta: previne ataques de timing (comparar velocidade
// de resposta para matrícula existente vs. inexistente).
const MIN_RESPONSE_MS = 300;

function delayedResponse(
  res: import('express').Response,
  startMs: number,
  status: number,
  body: object,
) {
  const wait = Math.max(0, MIN_RESPONSE_MS - (Date.now() - startMs));
  setTimeout(() => res.status(status).json(body), wait);
}

// Rate limit específico: 5 tentativas por IP a cada 15 min (apenas falhas).
// O rate limit global de /api/public (12/min) ainda se aplica em cima deste.
const matriculaLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: GENERIC_ERROR },
});

// GET /login-email — REMOVIDO (expunha e-mail do responsável sem senha).
// Retorna 410 para clientes com cache antigo, sem distinguir se a matrícula existe.
publicAuthRouter.get('/login-email', (_req, res) => {
  res.status(410).json({ code: 'endpoint_removed', message: 'Use POST /api/public/auth/matricula' });
});

/**
 * POST /auth/matricula
 *
 * Recebe { matricula, password } e autentica sem revelar o e-mail ao browser.
 *
 * Fluxo interno:
 *  1. Resolve matrícula → e-mail (nunca sai do backend).
 *  2. Chama o Neon Auth server-to-server com as credenciais.
 *  3. Encaminha o JWT via header set-auth-jwt (o fetchPlugin do authClient
 *     no frontend lê esse header e atualiza o estado interno automaticamente).
 *  4. Para matrícula inexistente, inativa, escola suspensa ou senha errada,
 *     responde com o MESMO status, corpo e atraso — sem diferença observável.
 */
publicAuthRouter.post('/auth/matricula', matriculaLimiter, async (req, res) => {
  const start = Date.now();
  const { matricula, password } = (req.body ?? {}) as Record<string, unknown>;

  if (
    typeof matricula !== 'string' || !matricula.trim() ||
    typeof password !== 'string' || !password
  ) {
    return delayedResponse(res, start, 400, { ok: false, message: GENERIC_ERROR });
  }

  if (!isDbConfigured) {
    return delayedResponse(res, start, 503, { ok: false, message: GENERIC_ERROR });
  }

  const authUrl = process.env.NEON_AUTH_URL;
  if (!authUrl) {
    console.error('[publicAuth] NEON_AUTH_URL não configurado');
    return delayedResponse(res, start, 503, { ok: false, message: GENERIC_ERROR });
  }

  // 1. Resolve matrícula → e-mail internamente.
  const email = await withSystem(async (c) => {
    // Aluno ativo → e-mail do responsável.
    const student = await c.query(
      `select g.email
         from public.students s
         join public.guardians g on g.id = s.guardian_id
         join public.schools sc on sc.id = s.school_id
        where s.registration_number = $1
          and s.status = 'active'
          and sc.status = 'active'
        limit 1`,
      [matricula.trim()],
    );
    if (student.rows[0]?.email) return student.rows[0].email as string;

    // Funcionário ativo → e-mail do funcionário.
    const staff = await c.query(
      `select t.email
         from public.teachers t
         join public.schools sc on sc.id = t.school_id
        where t.registration_number = $1
          and t.status = 'active'
          and sc.status = 'active'
        limit 1`,
      [matricula.trim()],
    );
    return (staff.rows[0]?.email as string | undefined) ?? null;
  }).catch(() => null);

  // 2. Chama o Neon Auth server-to-server.
  //    Para matrícula inexistente, usa um e-mail descartável para manter
  //    o timing de resposta consistente (a chamada ainda demora ~o mesmo).
  const loginEmail = email ?? `_noop_${Date.now()}@gestescolar.invalid`;

  async function trySignIn(pwd: string): Promise<{ ok: boolean; jwt: string | null }> {
    try {
      const r = await fetch(`${authUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: pwd, rememberMe: false }),
      });
      return { ok: r.ok, jwt: r.headers.get('set-auth-jwt') };
    } catch {
      return { ok: false, jwt: null };
    }
  }

  let auth = await trySignIn(password);

  // 3. Retrocompatibilidade: senhas iniciais de 6 dígitos eram duplicadas para 8.
  if (!auth.ok && /^\d{6}$/.test(password)) {
    auth = await trySignIn((password + password).slice(0, 8));
  }

  // 4. Falha (matrícula inválida OU senha errada OU conta inativa): mesma resposta.
  if (!email || !auth.ok || !auth.jwt) {
    if (email && !auth.ok) {
      // Matrícula existente mas senha errada — log de tentativa suspeita.
      console.warn('[publicAuth] MATRICULA_LOGIN_FAILED', { matricula: matricula.trim(), ip: req.ip });
    }
    return delayedResponse(res, start, 200, { ok: false, message: GENERIC_ERROR });
  }

  // 5. Sucesso: encaminha o JWT via header — o fetchPlugin do authClient
  //    no frontend processa set-auth-jwt e injeta o token sem expor o e-mail.
  res.setHeader('set-auth-jwt', auth.jwt);
  delayedResponse(res, start, 200, { ok: true });
});
