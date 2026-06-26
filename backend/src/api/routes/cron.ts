import { Router } from 'express';
import { pool } from '../../db/pool';

export const cronRouter = Router();

cronRouter.get('/overdue-invoices', async (req, res) => {
  const secret = req.headers['authorization'];
  const expected = process.env.CRON_SECRET;
  if (!expected) return res.status(500).json({ code: 'config_error', message: 'CRON_SECRET não configurado' });
  if (secret !== `Bearer ${expected}`) {
    return res.status(401).json({ code: 'unauthorized' });
  }

  const result = await pool.query(
    `update public.invoices
        set status = 'overdue', updated_at = now()
      where status = 'pending'
        and due_date < current_date
      returning id`,
  );

  res.json({ ok: true, updated: result.rowCount });
});
