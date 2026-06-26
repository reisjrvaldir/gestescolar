import { Router } from 'express';
import { pool, isDbConfigured } from '../../db/pool';

export const plansRouter = Router();

// GET /api/plans — público (landing/tela de planos). Só planos visíveis.
plansRouter.get('/', async (_req, res) => {
  if (!isDbConfigured) {
    return res.status(503).json({ code: 'db_unconfigured', message: 'Banco não configurado' });
  }
  const { rows } = await pool.query(
    `select id, name, student_limit, monthly_price, annual_price, discount_percentage, features_json
       from public.plans
      where is_public = true and is_pilot = false
      order by monthly_price asc`,
  );
  res.json({ ok: true, data: rows });
});
