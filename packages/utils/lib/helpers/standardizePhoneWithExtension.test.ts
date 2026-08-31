import { describe, expect, it } from 'vitest';
import { standardizePhoneWithExtension } from './helpers';

describe('standardizePhoneWithExtension', () => {
  it('standardizes a plain 10-digit number', () => {
    expect(standardizePhoneWithExtension('5558675309')).toBe('(555) 867-5309');
  });

  it('standardizes an 11-digit number with a leading 1', () => {
    expect(standardizePhoneWithExtension('15558675309')).toBe('(555) 867-5309');
  });

  it('standardizes already-formatted numbers consistently', () => {
    expect(standardizePhoneWithExtension('(555) 867-5309')).toBe('(555) 867-5309');
    expect(standardizePhoneWithExtension('555-867-5309')).toBe('(555) 867-5309');
  });

  it('preserves an extension', () => {
    expect(standardizePhoneWithExtension('5558675309 x5555')).toBe('(555) 867-5309 x5555');
    expect(standardizePhoneWithExtension('(555) 867-5309 ext. 42')).toBe('(555) 867-5309 x42');
    expect(standardizePhoneWithExtension('555-867-5309 extension 7')).toBe('(555) 867-5309 x7');
  });

  it('returns undefined for empty/whitespace/undefined input', () => {
    expect(standardizePhoneWithExtension(undefined)).toBeUndefined();
    expect(standardizePhoneWithExtension('')).toBeUndefined();
    expect(standardizePhoneWithExtension('   ')).toBeUndefined();
  });

  it('returns undefined when the base cannot be parsed to 10 digits', () => {
    expect(standardizePhoneWithExtension('12345')).toBeUndefined();
    expect(standardizePhoneWithExtension('not a phone')).toBeUndefined();
  });
});
