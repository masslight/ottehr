import { Settings } from 'luxon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getInputTypes,
  isNullOrUndefined,
  isNumber,
  isOlderThan18Years,
  isPositiveNumberOrZero,
  isValidNumber,
  isValidUUID,
} from './helper';

describe('validation/helper', () => {
  describe('isNumber', () => {
    it.each(['0', '1', '42', '3.14', '-5', '1e3'])('should return true for "%s"', (value) => {
      expect(isNumber(value)).toBe(true);
    });

    it.each(['', 'abc', '1 2', ' ', '1 ', ' 1'])('should return false for "%s"', (value) => {
      expect(isNumber(value)).toBe(false);
    });
  });

  describe('getInputTypes', () => {
    it('should return "number" for zip and weight fields', () => {
      expect(getInputTypes('patient-zip')).toBe('number');
      expect(getInputTypes('policy-holder-zip')).toBe('number');
      expect(getInputTypes('policy-holder-zip-2')).toBe('number');
      expect(getInputTypes('weight')).toBe('number');
    });

    it('should return "tel" for phone number fields', () => {
      expect(getInputTypes('patient-number')).toBe('tel');
      expect(getInputTypes('guardian-number')).toBe('tel');
      expect(getInputTypes('pcp-number')).toBe('tel');
      expect(getInputTypes('pharmacy-phone')).toBe('tel');
      expect(getInputTypes('responsible-party-number')).toBe('tel');
      expect(getInputTypes('phoneNumber')).toBe('tel');
    });

    it('should return "text" for unknown fields', () => {
      expect(getInputTypes('patient-name')).toBe('text');
      expect(getInputTypes('unknown')).toBe('text');
    });
  });

  describe('isOlderThan18Years', () => {
    let originalNow: typeof Settings.now;

    beforeEach(() => {
      originalNow = Settings.now;
      // Fix "now" to 2025-06-15T00:00:00Z
      const fixedMillis = Date.UTC(2025, 5, 15); // June 15, 2025
      Settings.now = () => fixedMillis;
    });

    afterEach(() => {
      Settings.now = originalNow;
    });

    it('should return true for dates more than 18 years ago', () => {
      expect(isOlderThan18Years('2000-01-01')).toBe(true);
      expect(isOlderThan18Years('2007-06-14')).toBe(true);
    });

    it('should return false for dates less than 18 years ago', () => {
      expect(isOlderThan18Years('2010-01-01')).toBe(false);
      expect(isOlderThan18Years('2025-01-01')).toBe(false);
    });

    it('should return false for exactly 18 years ago', () => {
      // Exactly 18 years — not strictly "older than"
      expect(isOlderThan18Years('2007-06-15')).toBe(false);
    });
  });

  describe('isNullOrUndefined', () => {
    it('should return true for null', () => {
      expect(isNullOrUndefined(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isNullOrUndefined(undefined)).toBe(true);
    });

    it('should return false for falsy but defined values', () => {
      expect(isNullOrUndefined(0)).toBe(false);
      expect(isNullOrUndefined('')).toBe(false);
      expect(isNullOrUndefined(false)).toBe(false);
    });

    it('should return false for truthy values', () => {
      expect(isNullOrUndefined('hello')).toBe(false);
      expect(isNullOrUndefined(42)).toBe(false);
      expect(isNullOrUndefined({})).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(42)).toBe(true);
      expect(isValidNumber(-1)).toBe(true);
      expect(isValidNumber(3.14)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isValidNumber(NaN)).toBe(false);
    });
  });

  describe('isPositiveNumberOrZero', () => {
    it('should return true for 0', () => {
      expect(isPositiveNumberOrZero(0)).toBe(true);
    });

    it('should return true for positive numbers', () => {
      expect(isPositiveNumberOrZero(1)).toBe(true);
      expect(isPositiveNumberOrZero(100.5)).toBe(true);
    });

    it('should return false for negative numbers', () => {
      expect(isPositiveNumberOrZero(-1)).toBe(false);
      expect(isPositiveNumberOrZero(-0.001)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isPositiveNumberOrZero(NaN)).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
    });
  });
});
