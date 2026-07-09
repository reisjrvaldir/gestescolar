// =============================================================
//  Matérias (disciplinas) da escola — catálogo por nível.
//  GET semeia um catálogo padrão (Infantil/Fundamental/Médio) na 1ª vez.
// =============================================================
import { Router } from 'express';
import type { PoolClient } from '@neondatabase/serverless';
import { withTenant } from '../../db/withTenant';
import { requireAuth } from '../../middleware/auth';

export const subjectsRouter = Router();
subjectsRouter.use(requireAuth);

const CATALOG: Record<string, string[]> = {
  infantil: ['Linguagem oral e escrita', 'Matemática', 'Natureza e sociedade', 'Artes', 'Música', 'Corpo e movimento'],
  fundamental: ['Português', 'Matemática', 'Ciências', 'História', 'Geografia', 'Inglês', 'Educação Física', 'Artes', 'Ensino Religioso'],
  medio: ['Língua Portuguesa', 'Literatura', 'Redação', 'Matemática', 'Física', 'Química', 'Biologia', 'História', 'Geografia', 'Filosofia', 'Sociologia', 'Inglês', 'Educação Física', 'Artes'],
};

/** Semeia o catálogo padrão de matérias por nível se a escola ainda não tem nenhuma. */
async function ensureCatalog(c: PoolClient, schoolId: string): Promise<void> {
  const { rows } = await c.query('select count(*)::int as n from public.subjects where school_id=$1', [schoolId]);
  if (rows[0].n > 0) return;
  for (const [level, names] of Object.entries(CATALOG)) {
    for (const name of names) {
      await c.query(
        'insert into public.subjects (school_id, name, level) values ($1,$2,$3)',
        [schoolId, name, level],
      );
    }
  }
}

// GET /api/subjects — matérias da escola (semeia catálogo por nível se vazio).
subjectsRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    await ensureCatalog(c, req.ctx!.schoolId!);
    const { rows } = await c.query(
      `select id, name, coalesce(level,'outros') as level
         from public.subjects where school_id=$1 order by level, name`,
      [req.ctx!.schoolId],
    );
    return rows;
  });
  res.json({ ok: true, data });
});
