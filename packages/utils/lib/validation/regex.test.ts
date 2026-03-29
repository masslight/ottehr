import { describe, expect, it } from 'vitest';
import {
  decimalRegex,
  emailRegex,
  emojiRegex,
  isoDateRegex,
  phoneRegex,
  ssnRegex,
  uuidRegex,
  yupSimpleDateRegex,
  zipRegex,
} from './regex';

describe('validation/regex', () => {
  describe('emailRegex', () => {
    it.each(['user@example.com', 'a@b.co', 'test+tag@domain.org'])('should match "%s"', (email) => {
      expect(emailRegex.test(email)).toBe(true);
    });

    it.each(['', 'user', '@domain.com', 'user@', 'user@domain', 'user @domain.com'])(
      'should not match "%s"',
      (email) => {
        expect(emailRegex.test(email)).toBe(false);
      }
    );
  });

  describe('zipRegex', () => {
    it.each(['12345', '00000', '99999'])('should match "%s"', (zip) => {
      expect(zipRegex.test(zip)).toBe(true);
    });

    it.each(['1234', '123456', 'abcde', '12 345', '12345-6789'])('should not match "%s"', (zip) => {
      expect(zipRegex.test(zip)).toBe(false);
    });
  });

  describe('phoneRegex', () => {
    it('should match formatted US phone numbers', () => {
      expect(phoneRegex.test('(555) 123-4567')).toBe(true);
      expect(phoneRegex.test('(000) 000-0000')).toBe(true);
    });

    it.each(['5551234567', '555-123-4567', '(555)123-4567', '(555) 1234567'])('should not match "%s"', (phone) => {
      expect(phoneRegex.test(phone)).toBe(false);
    });
  });

  describe('emojiRegex', () => {
    it('should match strings without emojis', () => {
      expect(emojiRegex.test('Hello world')).toBe(true);
      expect(emojiRegex.test('Test 123!')).toBe(true);
    });

    it('should not match strings with emojis', () => {
      expect(emojiRegex.test('Hello 😀')).toBe(false);
      expect(emojiRegex.test('🎉')).toBe(false);
    });
  });

  describe('isoDateRegex', () => {
    it.each(['2024-01-01', '2024-12-31', '2000-06-15'])('should match "%s"', (date) => {
      expect(isoDateRegex.test(date)).toBe(true);
    });

    it.each(['2024-13-01', '2024-00-01', '2024-01-32', '24-01-01', '2024/01/01', '2024-1-1'])(
      'should not match "%s"',
      (date) => {
        expect(isoDateRegex.test(date)).toBe(false);
      }
    );
  });

  describe('uuidRegex', () => {
    it('should match valid v4 UUIDs', () => {
      expect(uuidRegex.test('550e8400-e29b-4d04-a716-446655440000')).toBe(true);
      expect(uuidRegex.test('A550E840-E29B-4D04-A716-446655440000')).toBe(true);
    });

    it('should not match non-v4 UUIDs or invalid strings', () => {
      expect(uuidRegex.test('not-a-uuid')).toBe(false);
      expect(uuidRegex.test('')).toBe(false);
    });
  });

  describe('decimalRegex', () => {
    it.each(['0', '123', '3.14', '0.5', '100.00'])('should match "%s"', (value) => {
      expect(decimalRegex.test(value)).toBe(true);
    });

    it.each(['', '-1', 'abc', '.5', '3X14', '12 34'])('should not match "%s"', (value) => {
      expect(decimalRegex.test(value)).toBe(false);
    });
  });

  describe('yupSimpleDateRegex', () => {
    it.each(['01/15/2024', '12/31/2000'])('should match "%s"', (date) => {
      expect(yupSimpleDateRegex.test(date)).toBe(true);
    });

    it.each(['1/15/2024', '01/1/2024', '01/15/24', '2024-01-15'])('should not match "%s"', (date) => {
      expect(yupSimpleDateRegex.test(date)).toBe(false);
    });
  });

  describe('ssnRegex', () => {
    it('should match valid SSNs', () => {
      expect(ssnRegex.test('123-45-6789')).toBe(true);
      expect(ssnRegex.test('001-01-0001')).toBe(true);
    });

    it('should not match SSNs starting with 000 or 666', () => {
      expect(ssnRegex.test('000-45-6789')).toBe(false);
      expect(ssnRegex.test('666-45-6789')).toBe(false);
    });

    it('should not match SSNs with 00 in middle group', () => {
      expect(ssnRegex.test('123-00-6789')).toBe(false);
    });

    it('should not match SSNs with 0000 in last group', () => {
      expect(ssnRegex.test('123-45-0000')).toBe(false);
    });

    it('should not match unformatted SSNs', () => {
      expect(ssnRegex.test('123456789')).toBe(false);
    });
  });
});
