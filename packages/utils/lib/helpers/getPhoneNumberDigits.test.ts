import { describe, expect, it } from 'vitest';
import { getPhoneNumberDigits } from './helpers';

describe('getPhoneNumberDigits', () => {
  it('strips the +1 country code from an E.164-style number', () => {
    expect(getPhoneNumberDigits('+12021234567')).toBe('2021234567');
  });

  it('strips formatting characters from a display-formatted number', () => {
    expect(getPhoneNumberDigits('(202) 123-4567')).toBe('2021234567');
    expect(getPhoneNumberDigits('202-123-4567')).toBe('2021234567');
    expect(getPhoneNumberDigits('202 123 4567')).toBe('2021234567');
  });

  it('returns a bare 10-digit number unchanged', () => {
    expect(getPhoneNumberDigits('2021234567')).toBe('2021234567');
  });

  it('strips a leading 1 country code without a plus sign', () => {
    expect(getPhoneNumberDigits('12021234567')).toBe('2021234567');
  });

  it('returns undefined for empty/undefined input', () => {
    expect(getPhoneNumberDigits(undefined)).toBeUndefined();
    expect(getPhoneNumberDigits('')).toBeUndefined();
  });

  it('returns undefined when the input cannot be parsed to 10 digits', () => {
    expect(getPhoneNumberDigits('12345')).toBeUndefined();
    expect(getPhoneNumberDigits('not a phone')).toBeUndefined();
  });
});
