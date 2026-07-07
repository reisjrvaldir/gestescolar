// =============================================================
//  Conta de recebimento da escola (repasses).
//  - Chave PIX para onde a escola recebe o seu dinheiro.
//  - Onboarding + abertura de subconta ASAAS (split). Requer plano ativo.
//  Persistido em public.nuvende_accounts (1 por escola).
// =============================================================
import { Router } from 'express';
import { z } from 'zod';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole, requireActivePlan } from '../../middleware/auth';
import { isAsaasConfigured } from '../../lib/payments';
import { asaasCreateSubaccount } from '../../lib/payments/asaas';

export const payoutRouter = Router();
payoutRouter.use(requireAuth);

// GET /api/payout — dados da conta de recebimento da escola.
payoutRouter.get('/', async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const acc = await c.query(
      `select status, pix_key, pix_key_type, legal_name, cnpj,
              responsible_name, responsible_cpf, phone, email, bank_data_json, provider_account_id
         from public.nuvende_accounts where school_id = $1 limit 1`,
      [req.ctx!.schoolId],
    );
    const school = await c.query(
      `select asaas_wallet_id from public.schools where id = $1`,
      [req.ctx!.schoolId],
    );
    const row = acc.rows[0] ?? {};
    const bank = (row.bank_data_json ?? {}) as Record<string, any>;
    return {
      status: row.status ?? 'not_started',
      pix_key: row.pix_key ?? null,
      pix_key_type: row.pix_key_type ?? null,
      wallet_id: school.rows[0]?.asaas_wallet_id ?? null,
      asaas_configured: isAsaasConfigured,
      onboarding: {
        legal_name: row.legal_name ?? '',
        cnpj: row.cnpj ?? '',
        responsible_name: row.responsible_name ?? '',
        responsible_cpf: row.responsible_cpf ?? '',
        email: row.email ?? '',
        phone: row.phone ?? '',
        income_value: bank.income_value ?? null,
        company_type: bank.company_type ?? 'LIMITED',
        birth_date: bank.birth_date ?? '',
        address: bank.address ?? '',
        address_number: bank.address_number ?? '',
        complement: bank.complement ?? '',
        province: bank.province ?? '',
        postal_code: bank.postal_code ?? '',
      },
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

const onboardingSchema = z.object({
  legal_name: z.string().trim().min(2).max(200),
  cnpj: z.string().trim().min(11).max(20),
  responsible_name: z.string().trim().min(2).max(200),
  responsible_cpf: z.string().trim().min(11).max(20),
  email: z.string().trim().email(),
  phone: z.string().trim().min(10).max(20),
  income_value: z.number().positive(),
  company_type: z.enum(['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION']).optional(),
  birth_date: z.string().trim().optional(),
  address: z.string().trim().min(2),
  address_number: z.string().trim().min(1),
  complement: z.string().trim().optional(),
  province: z.string().trim().min(2),
  postal_code: z.string().trim().min(8).max(9),
});

// PUT /api/payout/onboarding — salva os dados para abertura da subconta.
payoutRouter.put('/onboarding', requireRole('school_admin', 'superadmin'), requireActivePlan, async (req, res) => {
  const p = onboardingSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'invalid', errors: p.error.flatten() });
  const d = p.data;
  const bank = {
    income_value: d.income_value,
    company_type: d.company_type ?? 'LIMITED',
    birth_date: d.birth_date || null,
    address: d.address,
    address_number: d.address_number,
    complement: d.complement || null,
    province: d.province,
    postal_code: d.postal_code.replace(/\D/g, ''),
  };
  await withTenant(req.ctx!, async (c) => {
    await c.query(
      `insert into public.nuvende_accounts
         (school_id, legal_name, cnpj, responsible_name, responsible_cpf, email, phone, bank_data_json, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,now())
       on conflict (school_id) do update set
         legal_name=excluded.legal_name, cnpj=excluded.cnpj,
         responsible_name=excluded.responsible_name, responsible_cpf=excluded.responsible_cpf,
         email=excluded.email, phone=excluded.phone,
         bank_data_json=excluded.bank_data_json, updated_at=now()`,
      [req.ctx!.schoolId, d.legal_name, d.cnpj, d.responsible_name, d.responsible_cpf, d.email, d.phone, JSON.stringify(bank)],
    );
  });
  res.json({ ok: true });
});

// POST /api/payout/subaccount — cria a subconta ASAAS a partir dos dados salvos.
payoutRouter.post('/subaccount', requireRole('school_admin', 'superadmin'), requireActivePlan, async (req, res) => {
  if (!isAsaasConfigured) {
    return res.status(503).json({ code: 'provider_off', message: 'Pagamentos não configurados.' });
  }

  const stored = await withTenant(req.ctx!, async (c) => {
    const acc = await c.query(
      `select legal_name, cnpj, responsible_name, email, phone, bank_data_json
         from public.nuvende_accounts where school_id = $1 limit 1`,
      [req.ctx!.schoolId],
    );
    const school = await c.query(`select asaas_wallet_id from public.schools where id = $1`, [req.ctx!.schoolId]);
    return { acc: acc.rows[0] as any, walletId: school.rows[0]?.asaas_wallet_id as string | null };
  });

  if (stored.walletId) {
    return res.status(409).json({ code: 'already_exists', message: 'Subconta já foi criada para esta escola.' });
  }
  const a = stored.acc;
  const bank = (a?.bank_data_json ?? {}) as Record<string, any>;
  if (!a || !a.legal_name || !a.cnpj || !a.email || !a.phone || !bank.postal_code || !bank.address) {
    return res.status(400).json({ code: 'incomplete', message: 'Complete os dados de recebimento antes de abrir a subconta.' });
  }

  try {
    const sub = await asaasCreateSubaccount({
      name: a.legal_name,
      email: a.email,
      cpfCnpj: a.cnpj,
      mobilePhone: a.phone,
      incomeValue: Number(bank.income_value ?? 1000),
      address: bank.address,
      addressNumber: bank.address_number,
      complement: bank.complement ?? undefined,
      province: bank.province,
      postalCode: bank.postal_code,
      companyType: bank.company_type,
      birthDate: bank.birth_date ?? undefined,
    });
    await withTenant(req.ctx!, async (c) => {
      await c.query(`update public.schools set asaas_wallet_id = $2 where id = $1`, [req.ctx!.schoolId, sub.walletId]);
      await c.query(
        `update public.nuvende_accounts set provider_account_id = $2, status = 'pending_documents', updated_at = now() where school_id = $1`,
        [req.ctx!.schoolId, sub.accountId],
      );
    });
    res.json({ ok: true, wallet_id: sub.walletId, status: 'pending_documents' });
  } catch (err: any) {
    // Ex.: em sandbox (conta CPF) o ASAAS retorna 403 aqui — repassa a mensagem.
    const msg = err?.message ?? 'Falha ao criar subconta no ASAAS';
    return res.status(422).json({ code: 'asaas_error', message: msg });
  }
});
