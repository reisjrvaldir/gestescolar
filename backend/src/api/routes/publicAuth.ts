import { Router } from 'express';
import { isDbConfigured } from '../../db/pool';
import { withSystem } from '../../db/withTenant';

/**
 * Rotas públicas de apoio ao login (sem autenticação).
 * Resolve a matrícula para o e-mail da conta, permitindo login por matrícula
 * (alunos/responsáveis e funcionários) enquanto o provedor de auth usa e-mail.
 */
export const publicAuthRouter = Router();

publicAuthRouter.get('/login-email', async (req, res) => {
  const matricula = String(req.query.matricula ?? '').trim();
  if (!matricula) return res.status(400).json({ code: 'missing_matricula' });
  if (!isDbConfigured) return res.status(503).json({ code: 'db_unavailable' });

  // Pré-autenticação (sem escola no contexto) → contexto de sistema.
  const email = await withSystem(async (c) => {
    // Matrícula de aluno → e-mail do responsável (login do aluno).
    const student = await c.query(
      `select g.email
         from public.students s
         join public.guardians g on g.id = s.guardian_id
        where s.registration_number = $1
        limit 1`,
      [matricula],
    );
    if (student.rows[0]?.email) return student.rows[0].email as string;

    // Matrícula de funcionário → e-mail do funcionário.
    const staff = await c.query(
      `select email from public.teachers where registration_number = $1 limit 1`,
      [matricula],
    );
    return (staff.rows[0]?.email as string | undefined) ?? null;
  });

  if (email) return res.json({ ok: true, data: { email } });
  return res.status(404).json({ code: 'not_found', message: 'Matrícula não encontrada.' });
});
