import { describe, expect, it } from 'vitest';
import { formatCurrency, formatCurrencyFromCents } from './convert';

describe('formatCurrency', () => {
  it('formats whole and fractional amounts to two decimals', () => {
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(12)).toBe('$12.00');
    expect(formatCurrency(12.5)).toBe('$12.50');
    expect(formatCurrency(12.345)).toBe('$12.35');
  });

  it('groups thousands US-style', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(9876543.21)).toBe('$9,876,543.21');
    expect(formatCurrency(-1234567)).toBe('-$1,234,567.00');
  });

  it('puts the minus sign before the dollar sign for negative amounts', () => {
    expect(formatCurrency(-14.69)).toBe('-$14.69');
    expect(formatCurrency(-0.5)).toBe('-$0.50');
  });

  it('does not render negative zero with a sign', () => {
    expect(formatCurrency(-0)).toBe('$0.00');
  });
});

describe('formatCurrencyFromCents', () => {
  it('converts cents to dollars', () => {
    expect(formatCurrencyFromCents(1469)).toBe('$14.69');
    expect(formatCurrencyFromCents(-1469)).toBe('-$14.69');
  });

  it('treats a missing amount as zero', () => {
    expect(formatCurrencyFromCents(undefined)).toBe('$0.00');
  });
});
