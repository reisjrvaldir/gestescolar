/**
 * Fragmento SQL canônico de visibilidade de eventos do calendário para o
 * responsável (guardian):
 *   - eventos globais  → class_id IS NULL
 *   - eventos de turma → class_id pertence a uma turma de um dos seus filhos
 *
 * Derivação dos filhos: guardians.user_id → students.guardian_id → students.class_id
 * Fonte da verdade: guardians.user_id = ctx.profileId AND guardian.school_id = ctx.schoolId
 *
 * Parâmetros:
 *   classIdCol    coluna a comparar, com alias se necessário ('class_id' ou 'sc.class_id')
 *   schoolIdParam índice $N do parâmetro school_id (geralmente 1)
 *   userIdParam   índice $N do parâmetro user_id do guardian (ctx.profileId)
 */
export function guardianCalendarWhere(
  classIdCol: string,
  schoolIdParam: number,
  userIdParam: number,
): string {
  return `(${classIdCol} IS NULL OR ${classIdCol} IN (
    SELECT s.class_id FROM public.students s
    JOIN public.guardians g ON g.id = s.guardian_id
    WHERE g.user_id = $${userIdParam} AND g.school_id = $${schoolIdParam}
      AND s.class_id IS NOT NULL
  ))`;
}
