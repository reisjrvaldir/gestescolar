// =============================================================
//  Geração de mensalidades e matrícula de um aluno recém-matriculado.
//  Regra: ao vincular o aluno a um plano, o sistema gera uma cobrança PIX
//  para cada mês do ano corrente a partir da matrícula (mês atual → dezembro).
//  Cada fatura é um SNAPSHOT IMUTÁVEL do plano — alterações futuras no plano
//  não afetam faturas já emitidas.
// =============================================================
import type { PoolClient } from '@neondatabase/serverless';
import type { TenantContext } from '../../db/withTenant';
import { withTenant } from '../../db/withTenant';
import { buildChargeForInvoice } from '../payments';

// Regra do dia de vencimento: '30' = mesmo dia da matrícula (≈1 mês depois);
// '05'/'10'/'15' = dia fixo do mês.
export type FirstDueRule = '30' | '05' | '10' | '15';

/** Snapshot do plano capturado no momento da geração da fatura. Imutável. */
export interface PlanSnapshot {
  name: string;
  monthly_fee: number;
  enrollment_fee: number;
  /** updated_at do plano em ISO 8601 — serve como version token. */
  version: string;
}

/** Arredondamento bancário: 2 casas decimais. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Calcula o valor final após desconto a partir do valor original. */
export function applyDiscount(original: number, discountPct: number): number {
  return round2(original * (1 - Math.max(0, Math.min(100, discountPct)) / 100));
}

/**
 * Cronograma de vencimentos das mensalidades.
 * REGRA: a 1ª mensalidade é sempre no MÊS SEGUINTE ao da matrícula — o mês da
 * matrícula (e anteriores) não geram mensalidade (são cobertos pela matrícula).
 * Gera do mês seguinte até dezembro do ano letivo da matrícula.
 */
export function monthlyDueSchedule(
  enrollment: Date,
  rule: FirstDueRule,
): { referenceMonth: string; due: string }[] {
  const year = enrollment.getFullYear();
  const startMonth = enrollment.getMonth() + 1;              // mês seguinte (0-based)
  const dueDay = rule === '30' ? enrollment.getDate() : Number(rule);
  const out: { referenceMonth: string; due: string }[] = [];
  for (let m = startMonth; m <= 11; m++) {
    const lastDay = new Date(year, m + 1, 0).getDate();       // último dia do mês
    const day = Math.min(dueDay, lastDay);                    // evita "31 de fev"
    const d = new Date(year, m, day, 12);
    out.push({ referenceMonth: `${year}-${String(m + 1).padStart(2, '0')}`, due: d.toISOString().slice(0, 10) });
  }
  return out;
}

/**
 * Insere as faturas de MENSALIDADE (status pending) do aluno para o restante do ano.
 * Roda DENTRO da transação de criação do aluno — apenas inserts, sem chamadas de rede.
 *
 * Idempotência: se já existir uma mensalidade ativa para o mesmo aluno/mês
 * (índice parcial invoices_student_refmonth_uq), o insert é silenciosamente ignorado.
 * O contador `skipped` indica quantas foram puladas por conflito.
 *
 * Snapshot: cada fatura recebe plan_id + plan_snapshot (imutável) + original_amount
 * + discount_pct. Alterar o plano depois não afeta estas faturas.
 */
export async function insertMonthlyInvoices(
  c: PoolClient,
  input: {
    schoolId: string;
    studentId: string;
    studentName: string;
    monthlyFee: number;         // valor final após desconto
    originalMonthlyFee: number; // monthly_fee bruto do plano (antes do desconto)
    discountPct: number;
    planId: string;
    planSnapshot: PlanSnapshot;
    firstDueRule?: FirstDueRule;
  },
): Promise<{ ids: string[]; skipped: number }> {
  if (input.monthlyFee <= 0) return { ids: [], skipped: 0 };
  const schedule = monthlyDueSchedule(new Date(), input.firstDueRule ?? '30');
  const ids: string[] = [];
  let skipped = 0;

  for (const { referenceMonth, due } of schedule) {
    const { rows } = await c.query(
      `insert into public.invoices
         (school_id, student_id, student_name, amount, due_date, status, kind, reference_month,
          plan_id, plan_snapshot, original_amount, discount_pct)
       values ($1,$2,$3,$4,$5,'pending','mensalidade',$6,$7,$8,$9,$10)
       on conflict (student_id, reference_month)
         where kind = 'mensalidade' and status <> 'cancelled'
         do nothing
       returning id`,
      [
        input.schoolId, input.studentId, input.studentName,
        input.monthlyFee, due, referenceMonth,
        input.planId, JSON.stringify(input.planSnapshot),
        input.originalMonthlyFee, input.discountPct,
      ],
    );
    if (rows.length > 0) {
      ids.push(rows[0].id);
    } else {
      skipped++;
    }
  }
  if (skipped > 0) {
    console.warn('[studentInvoices] mensalidades ignoradas por conflito de idempotência:', skipped, 'para student', input.studentId);
  }
  return { ids, skipped };
}

/**
 * Insere a fatura de MATRÍCULA (cobrança única no cadastro do aluno).
 * - dinheiro: já entra como paga (recebimento offline, sem PIX).
 * - pix/cartão: fica pendente e recebe cobrança depois.
 * Retorna null se não há valor de matrícula (nada a cobrar).
 *
 * Snapshot: mesma lógica das mensalidades — enrollment_fee, plan_id e plan_snapshot
 * ficam gravados e não são afetados por futuras alterações no plano.
 */
export async function insertEnrollmentInvoice(
  c: PoolClient,
  input: {
    schoolId: string;
    studentId: string;
    studentName: string;
    amount: number;             // valor final após desconto
    originalAmount: number;     // enrollment_fee bruto do plano (antes do desconto)
    discountPct: number;
    planId: string;
    planSnapshot: PlanSnapshot;
    paymentMethod: 'cash' | 'pix' | 'card';
  },
): Promise<{ id: string; paid: boolean } | null> {
  if (input.amount <= 0) return null;
  const cash = input.paymentMethod === 'cash';
  const today = new Date();
  const referenceMonth = today.toISOString().slice(0, 7);
  const { rows } = await c.query(
    `insert into public.invoices
       (school_id, student_id, student_name, amount, due_date, status, kind, reference_month,
        payment_method, paid_at, plan_id, plan_snapshot, original_amount, discount_pct)
     values ($1,$2,$3,$4,$5,$6,'matricula',$7,$8,$9,$10,$11,$12,$13)
     returning id`,
    [
      input.schoolId, input.studentId, input.studentName, input.amount,
      today.toISOString().slice(0, 10),
      cash ? 'paid' : 'pending',
      referenceMonth,
      cash ? 'cash' : null,
      cash ? today.toISOString() : null,
      input.planId, JSON.stringify(input.planSnapshot),
      input.originalAmount, input.discountPct,
    ],
  );
  return { id: rows[0].id, paid: cash };
}

/**
 * Gera a cobrança PIX de cada fatura recém-criada. Roda FORA da transação
 * de criação do aluno (cada fatura em sua própria transação curta) para não
 * segurar a transação principal durante chamadas de rede ao gateway.
 * Falhas pontuais não impedem o cadastro do aluno — ficam sem PIX gerado e
 * podem ser reemitidas manualmente pela gestão.
 */
export async function generatePixForNewInvoices(ctx: TenantContext, invoiceIds: string[]): Promise<void> {
  await Promise.allSettled(
    invoiceIds.map((id) =>
      withTenant(ctx, (c) => buildChargeForInvoice(c, ctx.schoolId!, id, 'PIX')).catch((err) => {
        console.error('[studentInvoices] falha ao gerar PIX da fatura', id, err?.message ?? err);
      }),
    ),
  );
}
