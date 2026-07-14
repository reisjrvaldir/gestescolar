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
import {
  asaasCreateSubaccount, asaasListSubaccountDocuments, asaasUploadSubaccountDocument,
  asaasSubaccountTransferPix,
} from '../../lib/payments/asaas';

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

// GET /api/payout/withdrawals — saldo disponível + histórico de saques.
payoutRouter.get('/withdrawals', requireRole('school_admin', 'financial', 'superadmin'), async (req, res) => {
  const data = await withTenant(req.ctx!, async (c) => {
    const bal = await c.query(
      `select available_balance::float8 as available, pending_balance::float8 as pending,
              withdrawn_total::float8 as withdrawn
         from public.school_balances where school_id = $1`,
      [req.ctx!.schoolId],
    );
    const acc = await c.query(
      `select pix_key, pix_key_type from public.nuvende_accounts where school_id = $1`,
      [req.ctx!.schoolId],
    );
    const hist = await c.query(
      `select id, amount::float8 as amount, status, requested_at, paid_at, failed_reason
         from public.withdrawals where school_id = $1 order by requested_at desc limit 20`,
      [req.ctx!.schoolId],
    );
    const b = bal.rows[0] ?? {};
    return {
      available: Number(b.available ?? 0),
      pending: Number(b.pending ?? 0),
      withdrawn: Number(b.withdrawn ?? 0),
      pix_key: acc.rows[0]?.pix_key ?? null,
      pix_key_type: acc.rows[0]?.pix_key_type ?? null,
      history: hist.rows.map((r: any) => ({
        id: r.id, amount: Number(r.amount), status: r.status,
        requested_at: r.requested_at, paid_at: r.paid_at, failed_reason: r.failed_reason,
      })),
    };
  });
  res.json({ ok: true, data });
});

// POST /api/payout/withdraw — saca (transfere via PIX) o saldo disponível da escola.
// Padrão reservar→executar→restaurar: debita o saldo de forma atômica (guarda
// anti-duplo-saque), chama o ASAAS e, se a transferência falhar, restaura o saldo.
payoutRouter.post('/withdraw', requireRole('school_admin', 'superadmin'), requireActivePlan, async (req, res) => {
  if (!isAsaasConfigured) {
    return res.status(503).json({ code: 'provider_off', message: 'Pagamentos não configurados.' });
  }
  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ code: 'bad_amount', message: 'Informe um valor de saque válido.' });
  }

  const prep = await withTenant(req.ctx!, async (c) => {
    const acc = await c.query(
      `select pix_key, pix_key_type, bank_data_json from public.nuvende_accounts where school_id = $1 limit 1`,
      [req.ctx!.schoolId],
    );
    const row = acc.rows[0];
    const bank = (row?.bank_data_json ?? {}) as Record<string, any>;
    const apiKey = bank.provider_api_key as string | undefined;
    if (!row?.pix_key) return { error: 'no_pix' as const };
    if (!apiKey) return { error: 'no_subaccount' as const };

    const upd = await c.query(
      `update public.school_balances
          set available_balance = available_balance - $2,
              withdrawn_total   = withdrawn_total + $2,
              updated_at = now()
        where school_id = $1 and available_balance >= $2
        returning available_balance::float8 as remaining`,
      [req.ctx!.schoolId, amount],
    );
    if (upd.rowCount === 0) return { error: 'insufficient' as const };

    const wd = await c.query(
      `insert into public.withdrawals (school_id, amount, status, requested_by, requested_at)
         values ($1,$2,'processing',$3, now()) returning id`,
      [req.ctx!.schoolId, amount, req.ctx!.profileId],
    );
    return { withdrawalId: wd.rows[0].id as string, pixKey: row.pix_key as string, pixKeyType: row.pix_key_type as string | null, apiKey };
  });

  if ('error' in prep) {
    const message =
      prep.error === 'no_pix' ? 'Cadastre a chave PIX de recebimento antes de sacar.'
      : prep.error === 'no_subaccount' ? 'Abra a subconta de recebimento antes de sacar.'
      : 'Saldo insuficiente para este saque.';
    return res.status(400).json({ code: prep.error, message });
  }

  try {
    const t = await asaasSubaccountTransferPix(prep.apiKey, {
      value: amount, pixKey: prep.pixKey, pixKeyType: prep.pixKeyType ?? undefined,
    });
    await withTenant(req.ctx!, async (c) => {
      await c.query(
        `update public.withdrawals set status='paid', nuvende_withdrawal_id=$2, paid_at=now(), updated_at=now() where id=$1`,
        [prep.withdrawalId, t.id],
      );
      await c.query(
        `insert into public.audit_logs (school_id, user_id, action, entity_type, entity_id, metadata)
         values ($1,$2,'WITHDRAWAL_REQUESTED','withdrawal',$3,$4)`,
        [req.ctx!.schoolId, req.ctx!.profileId, prep.withdrawalId, JSON.stringify({ amount, provider_transfer_id: t.id, status: t.status })],
      );
    });
    res.json({ ok: true, data: { withdrawal_id: prep.withdrawalId, provider_transfer_id: t.id, status: t.status, amount } });
  } catch (err: any) {
    // Restaura o saldo reservado e marca o saque como falho.
    await withTenant(req.ctx!, async (c) => {
      await c.query(
        `update public.school_balances
            set available_balance = available_balance + $2,
                withdrawn_total   = withdrawn_total - $2,
                updated_at = now()
          where school_id = $1`,
        [req.ctx!.schoolId, amount],
      );
      await c.query(
        `update public.withdrawals set status='failed', failed_reason=$2, updated_at=now() where id=$1`,
        [prep.withdrawalId, String(err?.message ?? 'Falha na transferência').slice(0, 300)],
      );
    });
    res.status(422).json({ code: 'transfer_failed', message: err?.message ?? 'Falha ao transferir via PIX.' });
  }
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
    // Guarda a apiKey da subconta em bank_data_json (NUNCA retornada ao frontend)
    // para poder enviar os documentos em nome dela.
    const newBank = { ...bank, provider_api_key: sub.apiKey ?? null };
    await withTenant(req.ctx!, async (c) => {
      await c.query(`update public.schools set asaas_wallet_id = $2 where id = $1`, [req.ctx!.schoolId, sub.walletId]);
      await c.query(
        `update public.nuvende_accounts
           set provider_account_id = $2, bank_data_json = $3, status = 'pending_documents', updated_at = now()
         where school_id = $1`,
        [req.ctx!.schoolId, sub.accountId, JSON.stringify(newBank)],
      );
    });
    res.json({ ok: true, wallet_id: sub.walletId, status: 'pending_documents' });
  } catch (err: any) {
    // Ex.: em sandbox (conta CPF) o ASAAS retorna 403 aqui — repassa a mensagem.
    const msg = err?.message ?? 'Falha ao criar subconta no ASAAS';
    return res.status(422).json({ code: 'asaas_error', message: msg });
  }
});

/** Lê a apiKey da subconta guardada em bank_data_json (server-side only). */
async function getSubaccountApiKey(req: any): Promise<string | null> {
  return withTenant(req.ctx!, async (c) => {
    const r = await c.query(
      `select bank_data_json from public.nuvende_accounts where school_id = $1 limit 1`,
      [req.ctx!.schoolId],
    );
    const bank = (r.rows[0]?.bank_data_json ?? {}) as Record<string, any>;
    return (bank.provider_api_key as string) ?? null;
  });
}

// GET /api/payout/documents — lista os documentos exigidos/enviados da subconta.
payoutRouter.get('/documents', requireRole('school_admin', 'superadmin'), requireActivePlan, async (req, res) => {
  const apiKey = await getSubaccountApiKey(req);
  if (!apiKey) return res.status(400).json({ code: 'no_subaccount', message: 'Abra a subconta antes de enviar documentos.' });
  try {
    const docs = await asaasListSubaccountDocuments(apiKey);
    res.json({ ok: true, data: docs });
  } catch (err: any) {
    res.status(422).json({ code: 'asaas_error', message: err?.message ?? 'Falha ao listar documentos' });
  }
});

const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB
const docSchema = z.object({
  type: z.string().trim().min(1).max(60),
  filename: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(1).max(120),
  file_data: z.string().min(10), // base64
});

// POST /api/payout/documents/:id — envia um arquivo para um grupo de documentos.
payoutRouter.post('/documents/:id', requireRole('school_admin', 'superadmin'), requireActivePlan, async (req, res) => {
  const p = docSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: 'invalid', errors: p.error.flatten() });
  if (Buffer.byteLength(p.data.file_data, 'base64') > MAX_DOC_SIZE) {
    return res.status(413).json({ code: 'too_large', message: 'Arquivo acima de 5MB.' });
  }
  const apiKey = await getSubaccountApiKey(req);
  if (!apiKey) return res.status(400).json({ code: 'no_subaccount', message: 'Abra a subconta antes de enviar documentos.' });
  try {
    const r = await asaasUploadSubaccountDocument(apiKey, req.params.id, {
      type: p.data.type, fileBase64: p.data.file_data, filename: p.data.filename, mime: p.data.mime,
    });
    res.json({ ok: true, data: r });
  } catch (err: any) {
    res.status(422).json({ code: 'asaas_error', message: err?.message ?? 'Falha ao enviar documento' });
  }
});
