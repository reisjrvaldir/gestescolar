import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePixSplit } from './fees';

test('split do exemplo da spec: R$ 250,00', () => {
  const s = calculatePixSplit(250);
  assert.equal(s.grossAmount, 250.0);
  assert.equal(s.nuvendePixFee, 1.99);
  assert.equal(s.platformFeeAmount, 7.5);   // 250 * 3%
  assert.equal(s.totalServiceFee, 9.49);    // 1,99 + 7,50
  assert.equal(s.schoolNetAmount, 240.51);  // 250 - 9,49
});

test('valor pequeno: R$ 50,00', () => {
  const s = calculatePixSplit(50);
  assert.equal(s.platformFeeAmount, 1.5);
  assert.equal(s.totalServiceFee, 3.49);
  assert.equal(s.schoolNetAmount, 46.51);
});

test('arredondamento de centavos: R$ 149,90', () => {
  const s = calculatePixSplit(149.9);
  assert.equal(s.platformFeeAmount, 4.5);    // 149,90 * 0,03 = 4,497 → 4,50
  assert.equal(s.totalServiceFee, 6.49);
  assert.equal(s.schoolNetAmount, 143.41);
});

test('rejeita valor zero ou negativo', () => {
  assert.throws(() => calculatePixSplit(0));
  assert.throws(() => calculatePixSplit(-10));
});

test('soma fecha: líquido + taxa total = bruto', () => {
  for (const v of [99.9, 250, 1000, 33.33]) {
    const s = calculatePixSplit(v);
    assert.equal(Math.round((s.schoolNetAmount + s.totalServiceFee) * 100) / 100, s.grossAmount);
  }
});
