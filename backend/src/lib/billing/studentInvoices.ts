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

const DUE_DAY = 10; // dia de vencimento padrão das mensalidades

function monthsFromEnrollmentToYearEnd(enrollmentDate = new Date()): { year: number; month: number }[] {
  const year = enrollmentDate.getFullYear();
  const startMonth = enrollmentDate.getMonth(); // 0-based
  const months: { year: number; month: number }[] = [];
  for (let m = startMonth; m <= 11; m++) months.push({ year, month: m });
  return months;
}

function dueDateFor(year: number, month0: number, today: Date): string {
  const due = new Date(year, month0, DUE_DAY, 12);
  // Evita gerar uma fatura do mês corrente já "nascendo vencida".
  if (due < today) {
    const grace = new Date(today);
    grace.setDate(grace.getDate() + 5);
    return grace.toISOString().slice(0, 10);
  }
  return due.toISOString().slice(0, 10);
}

/**
 * Insere as faturas (status pending) do aluno para o restante do ano.
 * Roda DENTRO da transação de criação do aluno — apenas inserts, sem
 * chamadas de rede (a cobrança PIX é gerada depois, ver generatePixForNewInvoices).
 */
export async function insertMonthlyInvoices(
  c: PoolClient,
  input: { schoolId: string; studentId: string; studentName: string; monthlyFee: number },
): Promise<string[]> {
  if (input.monthlyFee <= 0) return [];
  const today = new Date();
  const months = monthsFromEnrollmentToYearEnd(today);
  const ids: string[] = [];

  for (const { year, month } of months) {
    const dueDate = dueDateFor(year, month, today);
    const referenceMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const { rows } = await c.query(
      `insert into public.invoices
         (school_id, student_id, student_name, amount, due_date, status, kind, reference_month)
       values ($1,$2,$3,$4,$5,'pending','mensalidade',$6)
       returning id`,
      [input.schoolId, input.studentId, input.studentName, input.monthlyFee, dueDate, referenceMonth],
    );
    ids.push(rows[0].id);
  }
  return ids;
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
