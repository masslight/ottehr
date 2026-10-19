import { describe, expect, it } from 'vitest';
import { parseNumberInput } from '../../src/features/admin/vitals-alert-config/helpers';

describe('parseNumberInput', () => {
  it('parses valid numeric strings', () => {
    expect(parseNumberInput('0')).toBe(0);
    expect(parseNumberInput('95')).toBe(95);
    expect(parseNumberInput('36.6')).toBe(36.6);
    expect(parseNumberInput('-5')).toBe(-5);
    expect(parseNumberInput('1e2')).toBe(100);
  });

  it('treats a blank entry as cleared', () => {
    expect(parseNumberInput('')).toBeUndefined();
    expect(parseNumberInput('   ')).toBeUndefined();
  });

  it('treats a non-numeric entry as cleared rather than NaN', () => {
    ['-', '+', '.', 'abc', '1e', '1.2.3', '12px'].forEach((raw) => {
      expect(parseNumberInput(raw)).toBeUndefined();
    });
  });

  it('treats a non-finite entry as cleared', () => {
    expect(parseNumberInput('Infinity')).toBeUndefined();
    expect(parseNumberInput('-Infinity')).toBeUndefined();
    expect(parseNumberInput('NaN')).toBeUndefined();
  });
});
