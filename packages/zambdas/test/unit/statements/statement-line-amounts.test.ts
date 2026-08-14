import { describe, expect, it } from 'vitest';
import { applyPaymentToLines, shareByCharge } from '../../../src/shared/statements/statement-line-amounts';

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

describe('shareByCharge', () => {
  it('splits in proportion to each line charge', () => {
    expect(shareByCharge(4400, [10_400, 33_900])).toEqual([1032, 3368]);
  });

  it('gives the leftover cents to the last line so the lines add up', () => {
    const shares = shareByCharge(1001, [100, 100, 100]);

    expect(shares).toEqual([333, 333, 335]);
    expect(sum(shares)).toBe(1001);
  });

  it('gives a single line the whole amount', () => {
    expect(shareByCharge(4432, [10_400])).toEqual([4432]);
  });

  it('handles nothing to share and nothing to share it across', () => {
    expect(shareByCharge(0, [10_400, 33_900])).toEqual([0, 0]);
    expect(shareByCharge(4432, [])).toEqual([]);
  });

  it('falls back to the last line when no line carries a charge', () => {
    expect(shareByCharge(4432, [0, 0])).toEqual([0, 4432]);
  });

  it('adds up on a reversal that makes the amount negative', () => {
    expect(sum(shareByCharge(-1001, [100, 100, 100]))).toBe(-1001);
  });
});

describe('applyPaymentToLines', () => {
  it('fills each line in turn until the payment runs out', () => {
    expect(applyPaymentToLines(5000, [2000, 6800])).toEqual([2000, 3000]);
  });

  it('leaves a settled line settled when a later payment arrives', () => {
    expect(applyPaymentToLines(7000, [2000, 6800])).toEqual([2000, 5000]);
  });

  it('stops at what the visit owes, leaving the excess as an account credit', () => {
    const applied = applyPaymentToLines(10_000, [2000, 6800]);

    expect(applied).toEqual([2000, 6800]);
    expect(sum(applied)).toBe(8800);
  });

  it('skips a line that owes nothing rather than borrowing against it', () => {
    expect(applyPaymentToLines(3000, [0, 6800])).toEqual([0, 3000]);
  });

  it('applies nothing when there is no payment, nothing owed, or no lines', () => {
    expect(applyPaymentToLines(0, [2000, 6800])).toEqual([0, 0]);
    expect(applyPaymentToLines(5000, [0, 0])).toEqual([0, 0]);
    expect(applyPaymentToLines(5000, [])).toEqual([]);
  });
});
