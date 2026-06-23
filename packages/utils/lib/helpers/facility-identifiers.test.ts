import { describe, expect, it } from 'vitest';
import { isCLIAValid, isNPIValidWithChecksum } from './helpers';

describe('isNPIValidWithChecksum', () => {
  it('accepts NPIs with a valid CMS check digit', () => {
    expect(isNPIValidWithChecksum('1234567893')).toBe(true);
    expect(isNPIValidWithChecksum('1245319599')).toBe(true);
  });

  it('rejects a 10-digit number with an incorrect check digit', () => {
    expect(isNPIValidWithChecksum('1234567890')).toBe(false);
    expect(isNPIValidWithChecksum('1234567899')).toBe(false);
  });

  it('rejects values that are not exactly 10 digits', () => {
    expect(isNPIValidWithChecksum('123456789')).toBe(false);
    expect(isNPIValidWithChecksum('12345678933')).toBe(false);
  });

  it('rejects non-digit input', () => {
    expect(isNPIValidWithChecksum('12345A7893')).toBe(false);
    expect(isNPIValidWithChecksum('')).toBe(false);
  });
});

describe('isCLIAValid', () => {
  it('accepts well-formed CLIA numbers', () => {
    expect(isCLIAValid('05D1234567')).toBe(true);
    expect(isCLIAValid('09D0000001')).toBe(true);
  });

  it('rejects a lowercase d', () => {
    expect(isCLIAValid('05d1234567')).toBe(false);
  });

  it('rejects wrong lengths and missing D', () => {
    expect(isCLIAValid('5D1234567')).toBe(false);
    expect(isCLIAValid('05D123456')).toBe(false);
    expect(isCLIAValid('0512345678')).toBe(false);
    expect(isCLIAValid('')).toBe(false);
  });
});
