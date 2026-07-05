import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { withSystem } from '../../db/withTenant';

export const cronRouter = Router();

/** Comparação de string em tempo constante (evita side-channel por timing). */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

cronRouter.get('/overdue-invoices', async (req, res) => {
  const secret = req.headers['authorization'] ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected) return res.status(500).json({ code: 'config_error', message: 'CRON_SECRET não configurado' });
  if (!safeEqual(String(secret), `Bearer ${expected}`)) {
    return res.status(401).json({ code: 'unauthorized' });
  }

  // Job cross-escola → contexto de sistema (superadmin nas policies de RLS).
  const rowCount = await withSystem(async (c) => {
    const result = await c.query(
      `update public.invoices
          set status = 'overdue', updated_at = now()
        where status = 'pending'
          and due_date < current_date
        returning id`,
    );
    return result.rowCount;
  });

  res.json({ ok: true, updated: rowCount });
});
