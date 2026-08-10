import { Router } from 'express';
import { isDbConfigured } from '../../db/pool';
import { withSystem } from '../../db/withTenant';
import { validateBody } from '../../lib/validateBody';
import { publicLeadSchema } from '../../../../shared/schemas';

/**
 * Captura de interesse do popup "teste controlado" na landing page.
 * Sem autenticação — roda sob o rate limit de /api/public (12 req/min).
 */
export const publicLeadsRouter = Router();

publicLeadsRouter.post('/leads', validateBody(publicLeadSchema), async (req, res) => {
  if (!isDbConfigured) return res.status(503).json({ code: 'db_unavailable' });
  const p = req.body as import('../../../../shared/schemas').PublicLeadOutput;

  try {
    await withSystem(async (c) => {
      await c.query(
        `insert into public.leads (name, email, phone, school_name, message, source)
         values ($1,$2,$3,$4,$5,$6)`,
        [p.name, p.email, p.phone ?? null, p.school_name ?? null, p.message ?? null,
         p.source ?? 'landing_popup'],
      );
    });
    res.status(201).json({ ok: true });
  } catch (err: any) {
    console.error('[publicLeads.create] erro:', err?.message ?? err);
    res.status(500).json({ code: 'lead_create_failed', message: 'Não foi possível registrar seu interesse. Tente novamente.' });
  }
});
