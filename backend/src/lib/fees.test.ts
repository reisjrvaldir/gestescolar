import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePixSplit } from './fees';

test('split do exemplo: R$ 250,00', () => {
  const s = calculatePixSplit(250);
  assert.equal(s.grossAmount, 250.0);
  assert.equal(s.nuvendePixFee, 0);
  assert.equal(s.platformFeeAmount, 12.5);   // 250 * 5%
  assert.equal(s.totalServiceFee, 12.5);
  assert.equal(s.schoolNetAmount, 237.5);    // 250 - 12,50
});

test('valor pequeno: R$ 50,00', () => {
  const s = calculatePixSplit(50);
  assert.equal(s.platformFeeAmount, 2.5);
  assert.equal(s.totalServiceFee, 2.5);
  assert.equal(s.schoolNetAmount, 47.5);
});

test('arredondamento de centavos: R$ 149,90', () => {
  const s = calculatePixSplit(149.9);
  assert.equal(s.platformFeeAmount, 7.5);    // 149,90 * 0,05 = 7,495 → 7,50
  assert.equal(s.totalServiceFee, 7.5);
  assert.equal(s.schoolNetAmount, 142.4);
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
