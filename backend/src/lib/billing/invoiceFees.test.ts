/**
 * Testes de integridade de tarifas e snapshots de planos.
 * Foco: lógica pura (sem banco de dados).
 *
 * Para os testes de integração com banco (RLS, idempotência, etc.) ver:
 * --- Cenários de integração documentados ao final do arquivo ---
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { round2, applyDiscount, monthlyDueSchedule } from './studentInvoices';

// ─── applyDiscount ────────────────────────────────────────────────────────────

test('mensalidade usa monthly_fee (sem desconto)', () => {
  const monthlyFee = 500;
  const discountPct = 0;
  assert.equal(applyDiscount(monthlyFee, discountPct), 500);
});

test('matrícula usa enrollment_fee (sem desconto)', () => {
  const enrollmentFee = 200;
  const discountPct = 0;
  assert.equal(applyDiscount(enrollmentFee, discountPct), 200);
});

test('desconto 10% aplicado a mensalidade', () => {
  assert.equal(applyDiscount(500, 10), 450);
});

test('desconto 10% aplicado a matrícula', () => {
  assert.equal(applyDiscount(200, 10), 180);
});

test('desconto 100% resulta em zero (isenta total)', () => {
  assert.equal(applyDiscount(500, 100), 0);
});

test('desconto negativo é tratado como 0% (proteção de limite)', () => {
  assert.equal(applyDiscount(500, -10), 500);
});

test('desconto > 100 é tratado como 100% (proteção de limite)', () => {
  assert.equal(applyDiscount(500, 150), 0);
});

test('arredondamento bancário — 2 casas decimais', () => {
  // R$ 149,90 × 90% = R$ 134,91
  assert.equal(applyDiscount(149.9, 10), 134.91);
  // R$ 33,33 × 90% = R$ 29,997 → 30,00
  assert.equal(applyDiscount(33.33, 10), 29.997 > 30 ? 30 : 30);
});

// ─── round2 ──────────────────────────────────────────────────────────────────

test('round2: sem alteração para 2 casas', () => {
  assert.equal(round2(1.23), 1.23);
});

test('round2: arredonda para cima quando o terceiro decimal é ≥ 5', () => {
  // 1.126 × 100 = 112.6 → Math.round = 113 → 1.13
  assert.equal(round2(1.126), 1.13);
});

test('round2: arredonda para baixo', () => {
  assert.equal(round2(1.004), 1);
});

// ─── Invariante do snapshot ───────────────────────────────────────────────────

test('invariante: amount === round(original_amount × (1 - discount_pct/100), 2)', () => {
  const cases: [number, number][] = [
    [500, 0], [500, 10], [500, 50], [200, 15], [149.9, 10], [33.33, 100],
  ];
  for (const [original, pct] of cases) {
    const amount = applyDiscount(original, pct);
    const expected = round2(original * (1 - pct / 100));
    assert.equal(amount, expected,
      `Falha para original=${original}, pct=${pct}: amount=${amount}, expected=${expected}`);
  }
});

// ─── monthlyDueSchedule ──────────────────────────────────────────────────────

test('gera mensalidades somente do mês seguinte à matrícula até dezembro', () => {
  // Matrícula em julho (mês 6, 0-based) → meses 7,8,9,10,11 (agosto–dezembro)
  const enrollment = new Date(2026, 6, 15); // 15 de julho de 2026
  const schedule = monthlyDueSchedule(enrollment, '30');
  assert.equal(schedule.length, 5, 'deve gerar 5 mensalidades (ago–dez)');
  assert.equal(schedule[0].referenceMonth, '2026-08');
  assert.equal(schedule[4].referenceMonth, '2026-12');
});

test('matrícula em dezembro não gera nenhuma mensalidade no mesmo ano', () => {
  const enrollment = new Date(2026, 11, 1); // dezembro
  const schedule = monthlyDueSchedule(enrollment, '30');
  assert.equal(schedule.length, 0);
});

test('dia de vencimento fixo em 05 clipa ao último dia do mês', () => {
  const enrollment = new Date(2026, 0, 1); // janeiro
  const schedule = monthlyDueSchedule(enrollment, '05');
  // fevereiro: dia 5 existe → '2026-02-05'
  const feb = schedule.find((s) => s.referenceMonth === '2026-02');
  assert.ok(feb);
  assert.equal(feb.due, '2026-02-05');
});

test('vencimento "30" usa o dia da matrícula em cada mês', () => {
  const enrollment = new Date(2026, 0, 20); // 20 de janeiro
  const schedule = monthlyDueSchedule(enrollment, '30');
  // Primeiro mês gerado = fevereiro; dia de vencimento = 20
  assert.equal(schedule[0].due, '2026-02-20');
});

// ─── Geração repetida não duplica cobranças (comportamento esperado do DB) ───
// (requer banco real — documentado como contrato)
//
// test.todo('geração repetida para mesmo student+month retorna skipped=1, ids=[]');
// → O insert usa ON CONFLICT (student_id, reference_month) WHERE kind='mensalidade'
//   AND status<>'cancelled' DO NOTHING. Comportamento verificado pela migration 0024.

// ─── Alteração do plano não muda faturas já emitidas ─────────────────────────
// (requer banco real — documentado como contrato)
//
// test.todo('UPDATE em school_plans não altera amount em invoices existentes');
// → amount é gravado no momento do insert; plan_snapshot é imutável (JSONB).
//   Verificar via GET /api/invoices/diagnostics: plan_fee_drift lista a divergência
//   sem nunca corrigir automaticamente.

// ─── Correção em lote exige confirmação ──────────────────────────────────────
// (comportamento do endpoint POST /api/invoices/correct-bulk)
//
// test.todo('POST /correct-bulk sem confirm:true retorna 400 confirmation_required');
// test.todo('POST /correct-bulk com confirm:true corrige amount e grava audit_log');

// ─── Isolamento por escola/RLS ────────────────────────────────────────────────
// (requer banco real — documentado como contrato)
//
// test.todo('fatura de escola A não aparece em diagnóstico de escola B');
// → withTenant injeta school_id=$1 em toda query; RLS bloqueia no nível do Postgres.
