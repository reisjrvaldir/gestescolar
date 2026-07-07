// =============================================================
//  Conta de recebimento da escola (repasses).
//  - Chave PIX para onde a escola recebe o seu dinheiro.
//  - (Fase 2) abertura de subconta ASAAS p/ split — ver POST /subaccount.
//  Persistido em public.nuvende_accounts (1 por escola).
// =============================================================
import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole, requireActivePlan } from '../../middleware/auth';

export const payoutRouter = Router();
payoutRouter.use(requireAuth);

// GET /api/payout — dados da conta de recebimento da escola.
payoutRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const acc = await c.query(
      `select status, pix_key, pix_key_type, legal_name, cnpj,
              responsible_name, responsible_cpf, phone, email
         from public.nuvende_accounts where school_id = $1 limit 1`,
      [req.ctx!.schoolId],
    );
    const school = await c.query(
      `select asaas_wallet_id from public.schools where id = $1`,
      [req.ctx!.schoolId],
    );
    const row = acc.rows[0] ?? {};
    return {
      status: row.status ?? 'not_started',
      pix_key: row.pix_key ?? null,
      pix_key_type: row.pix_key_type ?? null,
      wallet_id: school.rows[0]?.asaas_wallet_id ?? null,
    };
  });
  res.json({ ok: true, data });
});

const pixSchema = z.object({
  pix_key: z.string().trim().min(1).max(140),
  pix_key_type: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP']),
});

// PUT /api/payout/pix — cadastra/atualiza a chave PIX de recebimento.
payoutRouter.put('/pix', requireRole('school_admin', 'superadmin'), requireActivePlan, async (req, res) => {
  const p = pixSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'invalid', errors: p.error.flatten() });
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `insert into public.nuvende_accounts (school_id, pix_key, pix_key_type, updated_at)
         values ($1, $2, $3, now())
       on conflict (school_id) do update
         set pix_key = excluded.pix_key,
             pix_key_type = excluded.pix_key_type,
             updated_at = now()`,
      [req.ctx!.schoolId, p.data.pix_key, p.data.pix_key_type],
    );
  });
  res.json({ ok: true });
});
