import type { PoolClient } from '@neondatabase/serverless';

/**
 * Verifica se o remetente (ctx) tem permissão de enviar mensagem ao destinatário.
 *
 * Regras canônicas — espelham exatamente o GET /messages/contacts de cada papel:
 *
 *   GUARDIAN  → school_admin/coordinator ativos
 *              OU professor (regente ou por disciplina) de turma de um dos seus filhos
 *
 *   TEACHER   → school_admin/coordinator ativos
 *              OU responsável de aluno em turma que o professor leciona
 *
 *   Demais    → qualquer profile ativo da mesma escola (sem restrição adicional)
 *
 * @returns true  — envio autorizado
 *          false — destinatário inexistente, inativo, de outra escola,
 *                  ou não autorizado pelo papel do remetente
 */
export async function canMessageRecipient(
  c: PoolClient,
  ctx: { role: string; profileId: string; schoolId: string },
  recipientId: string,
): Promise<boolean> {
  const { role, profileId, schoolId } = ctx;

  if (role === 'guardian') {
    const r = await c.query(
      `SELECT 1 FROM public.profiles p
        WHERE p.id = $1 AND p.school_id = $2 AND p.status = 'active'
          AND (
            -- admin e coordenador sempre autorizados
            p.role IN ('school_admin', 'coordinator')

            OR

            -- professor (regente ou disciplina) de turma de um dos filhos do responsável
            EXISTS (
              SELECT 1
                FROM public.guardians  g
                JOIN public.students   s  ON s.guardian_id = g.id
                                         AND s.school_id   = $2
                                         AND s.status      = 'active'
                JOIN public.classes    cl ON cl.id          = s.class_id
                                         AND cl.school_id   = $2
                JOIN public.teachers   t  ON t.school_id    = $2
                                         AND (
                                           t.id = cl.teacher_id
                                           OR EXISTS (
                                             SELECT 1 FROM public.class_subjects cs
                                              WHERE cs.class_id   = cl.id
                                                AND cs.teacher_id = t.id
                                                AND cs.school_id  = $2
                                           )
                                         )
               WHERE g.user_id    = $3
                 AND g.school_id  = $2
                 AND t.user_id    = p.id
            )
          )
        LIMIT 1`,
      [recipientId, schoolId, profileId],
    );
    return r.rows.length > 0;
  }

  if (role === 'teacher') {
    const r = await c.query(
      `SELECT 1 FROM public.profiles p
        WHERE p.id = $1 AND p.school_id = $2 AND p.status = 'active'
          AND (
            -- admin e coordenador sempre autorizados
            p.role IN ('school_admin', 'coordinator')

            OR

            -- responsável de aluno em turma que o professor leciona
            EXISTS (
              SELECT 1
                FROM public.teachers   t
                JOIN public.classes    cl ON cl.school_id = $2
                                         AND (
                                           cl.teacher_id = t.id
                                           OR EXISTS (
                                             SELECT 1 FROM public.class_subjects cs
                                              WHERE cs.class_id   = cl.id
                                                AND cs.teacher_id = t.id
                                                AND cs.school_id  = $2
                                           )
                                         )
                JOIN public.students   s  ON s.class_id   = cl.id
                                         AND s.school_id   = $2
                                         AND s.status      = 'active'
                JOIN public.guardians  g  ON g.id          = s.guardian_id
                                         AND g.school_id   = $2
               WHERE t.user_id   = $3
                 AND t.school_id = $2
                 AND g.user_id   = p.id
            )
          )
        LIMIT 1`,
      [recipientId, schoolId, profileId],
    );
    return r.rows.length > 0;
  }

  // Admin, financeiro, coordenador, superadmin: qualquer profile ativo da escola.
  const r = await c.query(
    `SELECT 1 FROM public.profiles WHERE id=$1 AND school_id=$2 AND status='active' LIMIT 1`,
    [recipientId, schoolId],
  );
  return r.rows.length > 0;
}
