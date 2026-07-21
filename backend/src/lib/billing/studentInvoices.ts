// =============================================================
//  Geração de mensalidades (faturas) de um aluno recém-matriculado.
//  Regra: ao vincular o aluno a um plano, o sistema gera uma cobrança PIX
//  para cada mês do ano corrente a partir da matrícula (mês atual → dezembro).
//  Cada fatura fica marcada com reference_month (para o financeiro apurar a
//  previsão de receita por mês) e recebe seu próprio código PIX.
// =============================================================
import type { PoolClient } from '@neondatabase/serverless';
import type { TenantContext } from '../../db/withTenant';
import { withTenant } from '../../db/withTenant';
import { buildChargeForInvoice } from '../payments';

// Regra do dia de vencimento: '30' = mesmo dia da matrícula (≈1 mês depois);
// '05'/'10'/'15' = dia fixo do mês.
export type FirstDueRule = '30' | '05' | '10' | '15';

/**
 * Cronograma de vencimentos das mensalidades.
 * REGRA: a 1ª mensalidade é sempre no MÊS SEGUINTE ao da matrícula — o mês da
 * matrícula (e anteriores) não geram mensalidade (são cobertos pela matrícula).
 * Gera do mês seguinte até dezembro do ano letivo da matrícula.
 */
function monthlyDueSchedule(enrollment: Date, rule: FirstDueRule): { referenceMonth: string; due: string }[] {
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
 * Insere as faturas (status pending) do aluno para o restante do ano.
 * Roda DENTRO da transação de criação do aluno — apenas inserts, sem
 * chamadas de rede (a cobrança PIX é gerada depois, ver generatePixForNewInvoices).
 */
export async function insertMonthlyInvoices(
  c: PoolClient,
  input: { schoolId: string; studentId: string; studentName: string; monthlyFee: number; firstDueRule?: FirstDueRule },
): Promise<string[]> {
  if (input.monthlyFee <= 0) return [];
  const schedule = monthlyDueSchedule(new Date(), input.firstDueRule ?? '30');
  const ids: string[] = [];

  for (const { referenceMonth, due } of schedule) {
    const { rows } = await c.query(
      `insert into public.invoices
         (school_id, student_id, student_name, amount, due_date, status, kind, reference_month)
       values ($1,$2,$3,$4,$5,'pending','mensalidade',$6)
       returning id`,
      [input.schoolId, input.studentId, input.studentName, input.monthlyFee, due, referenceMonth],
    );
    ids.push(rows[0].id);
  }
  return ids;
}

/**
 * Insere a fatura de MATRÍCULA (cobrança única no cadastro do aluno).
 * - dinheiro: já entra como paga (recebimento offline, sem PIX).
 * - pix/cartão: fica pendente e recebe cobrança depois (ver generatePix...).
 * Retorna null se não há valor de matrícula (nada a cobrar).
 */
export async function insertEnrollmentInvoice(
  c: PoolClient,
  input: { schoolId: string; studentId: string; studentName: string; amount: number; paymentMethod: 'cash' | 'pix' | 'card' },
): Promise<{ id: string; paid: boolean } | null> {
  if (input.amount <= 0) return null;
  const cash = input.paymentMethod === 'cash';
  const today = new Date();
  const referenceMonth = today.toISOString().slice(0, 7);
  const { rows } = await c.query(
    `insert into public.invoices
       (school_id, student_id, student_name, amount, due_date, status, kind, reference_month, payment_method, paid_at)
     values ($1,$2,$3,$4,$5,$6,'matricula',$7,$8,$9)
     returning id`,
    [
      input.schoolId, input.studentId, input.studentName, input.amount,
      today.toISOString().slice(0, 10),
      cash ? 'paid' : 'pending',
      referenceMonth,
      cash ? 'cash' : null,
      cash ? today.toISOString() : null,
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
