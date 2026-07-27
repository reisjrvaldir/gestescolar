import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';

export const personalDataRouter = Router();
personalDataRouter.use(requireAuth);

// Whitelist de colunas por tipo de entidade — impede SQL injection via interpolação
const ALLOWED_COLS: Record<string, Record<string, string>> = {
  student:  { cpf: 'cpf', rg: 'rg' },
  guardian: { cpf: 'cpf', phone: 'phone', phone2: 'phone2', email: 'email' },
  staff:    { cpf: 'cpf', phone: 'phone', email: 'email' },
};

const ENTITY_TABLE: Record<string, string> = {
  student:  'public.students',
  guardian: 'public.guardians',
  staff:    'public.teachers',
};

const revealSchema = z.object({
  entity_type:   z.enum(['student', 'guardian', 'staff']),
  entity_id:     z.string().uuid(),
  field:         z.enum(['cpf', 'rg', 'phone', 'phone2', 'email']),
  justification: z.string().min(10, 'Justificativa deve ter pelo menos 10 caracteres').max(500),
});

/**
 * POST /api/personal-data/reveal
 * Retorna o valor real de um campo mascarado e registra o acesso na trilha de
 * auditoria LGPD. O valor revelado NÃO é gravado no log.
 * Requer papel school_admin, financial ou superadmin.
 * Valida multi-tenant: a entidade deve pertencer à escola do requisitante.
 */
personalDataRouter.post(
  '/reveal',
  requireRole('school_admin', 'financial', 'superadmin'),
  async (req, res) => {
    const parsed = revealSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'validation', message: parsed.error.issues[0]?.message });
    }
    const { entity_type, entity_id, field, justification } = parsed.data;

    const col = ALLOWED_COLS[entity_type]?.[field];
    if (!col) {
      return res.status(400).json({ code: 'invalid_field', message: 'Campo não disponível para este tipo de entidade.' });
    }

    try {
      const result = await withTenant(req.ctx!, async (c) => {
        const table = ENTITY_TABLE[entity_type]!;
        const schoolId = req.ctx!.schoolId;

        // Lê o valor real — WHERE school_id garante isolamento multi-tenant
        const { rows } = await c.query(
          `select name, ${col}::text as value from ${table} where id=$1 and school_id=$2 limit 1`,
          [entity_id, schoolId],
        );
        if (rows.length === 0) return { error: 'not_found' as const };

        const entityName: string = rows[0].name;
        const realValue: string | null = rows[0].value;

        // Trilha de auditoria — o valor revelado NÃO é armazenado aqui
        await c.query(
          `insert into public.personal_data_access_log
             (school_id, accessed_by_profile_id, entity_type, entity_id,
              entity_name, field_name, justification)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [schoolId, req.ctx!.profileId, entity_type, entity_id, entityName, field, justification],
        );

        return { value: realValue };
      });

      if ('error' in result) {
        return res.status(404).json({ code: 'not_found', message: 'Registro não encontrado ou não pertence à sua escola.' });
      }
      res.json({ ok: true, data: { value: result.value } });
    } catch (err: any) {
      console.error('[personal-data.reveal] erro:', err?.message ?? err);
      res.status(500).json({
        code: 'reveal_failed',
        message: 'Falha ao revelar o dado. Verifique se a tabela personal_data_access_log foi criada no Neon SQL Editor.',
      });
    }
  },
);

/**
 * GET /api/personal-data/audit
 * Retorna as últimas 200 entradas da trilha de auditoria da escola.
 * Visível apenas para school_admin e superadmin.
 */
personalDataRouter.get(
  '/audit',
  requireRole('school_admin', 'superadmin'),
  async (req, res) => {
    const data = await withTenant(req.ctx!, async (c) => {
      const { rows } = await c.query(
        `select l.id,
                coalesce(p.name, l.accessed_by_profile_id::text) as accessed_by,
                l.entity_type, l.entity_name, l.field_name,
                l.justification, l.revealed_at
           from public.personal_data_access_log l
           left join public.profiles p on p.id = l.accessed_by_profile_id
          where l.school_id = $1
          order by l.revealed_at desc
          limit 200`,
        [req.ctx!.schoolId],
      );
      return rows;
    });
    res.json({ ok: true, data });
  },
);
