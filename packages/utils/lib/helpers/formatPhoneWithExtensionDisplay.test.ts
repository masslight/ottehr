import { describe, expect, it } from 'vitest';
import { formatPhoneWithExtensionDisplay, PHONE_NOT_ON_FILE } from './helpers';

describe('formatPhoneWithExtensionDisplay', () => {
  it('formats a plain 10-digit number', () => {
    expect(formatPhoneWithExtensionDisplay('5558675309')).toBe('(555) 867-5309');
  });

  it('formats an 11-digit number with a leading 1', () => {
    expect(formatPhoneWithExtensionDisplay('15558675309')).toBe('(555) 867-5309');
  });

  it('reformats an already-formatted number consistently', () => {
    expect(formatPhoneWithExtensionDisplay('(555) 867-5309')).toBe('(555) 867-5309');
    expect(formatPhoneWithExtensionDisplay('555-867-5309')).toBe('(555) 867-5309');
  });

  it('appends an extension', () => {
    expect(formatPhoneWithExtensionDisplay('5558675309 x5555')).toBe('(555) 867-5309 x5555');
    expect(formatPhoneWithExtensionDisplay('(555) 867-5309 ext. 42')).toBe('(555) 867-5309 x42');
    expect(formatPhoneWithExtensionDisplay('555-867-5309 extension 7')).toBe('(555) 867-5309 x7');
  });

  it('returns the not-on-file string for empty/whitespace/undefined input', () => {
    expect(formatPhoneWithExtensionDisplay(undefined)).toBe(PHONE_NOT_ON_FILE);
    expect(formatPhoneWithExtensionDisplay('')).toBe(PHONE_NOT_ON_FILE);
    expect(formatPhoneWithExtensionDisplay('   ')).toBe(PHONE_NOT_ON_FILE);
  });

  it('returns the raw input when the base cannot be parsed to 10 digits', () => {
    expect(formatPhoneWithExtensionDisplay('12345')).toBe('12345');
    expect(formatPhoneWithExtensionDisplay('not a phone')).toBe('not a phone');
  });
});
