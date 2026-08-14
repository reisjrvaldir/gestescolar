import type { PoolClient } from '@neondatabase/serverless';
import type { TenantContext } from '../db/withTenant';

/**
 * Professor só enxerga turma que ele leciona.
 *
 * A regra de posse é a mesma de `GET /classes/mine`: é dono da turma quem for
 * REGENTE (`classes.teacher_id`) ou responsável por alguma matéria nela
 * (`class_subjects.teacher_id`). Duplicar essa regra em cada rota levaria a
 * versões divergentes com o tempo — por isso fica centralizada aqui.
 *
 * Demais papéis de equipe (gestor, coordenação, financeiro, superadmin) veem
 * todas as turmas da própria escola; o isolamento entre ESCOLAS é do
 * withTenant/`school_id` e não se mistura com este controle.
 *
 * Sem `classId` o recorte é a escola inteira: para professor isso é sempre
 * negado, porque não há como limitar o resultado às turmas dele.
 */
export async function teacherCanAccessClass(
  c: PoolClient,
  ctx: TenantContext,
  classId: string | null | undefined,
): Promise<boolean> {
  if (ctx.role !== 'teacher') return true;
  if (!classId) return false;

  const { rows } = await c.query(
    `select 1
       from public.classes cl
       join public.teachers t on t.user_id = $1 and t.school_id = $2
      where cl.id = $3 and cl.school_id = $2
        and (cl.teacher_id = t.id
             or exists (select 1
                          from public.class_subjects cs
                         where cs.class_id = cl.id and cs.teacher_id = t.id))
      limit 1`,
    [ctx.profileId, ctx.schoolId, classId],
  );
  return rows.length > 0;
}
