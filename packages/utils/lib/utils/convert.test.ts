import { describe, expect, it } from 'vitest';
import {
  convertBooleanToString,
  convertToBoolean,
  isNumericValue,
  roundNumberToDecimalPlaces,
  textToNumericValue,
} from './convert';

describe('convert', () => {
  describe('convertToBoolean', () => {
    it('should return undefined for undefined input', () => {
      expect(convertToBoolean(undefined)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(convertToBoolean('')).toBeUndefined();
    });

    it.each([
      ['yes', true],
      ['Yes', true],
      ['YES', true],
      ['true', true],
      ['True', true],
      ['1', true],
      ['on', true],
      ['y', true],
    ])('should return true for "%s"', (input, expected) => {
      expect(convertToBoolean(input)).toBe(expected);
    });

    it.each([
      ['no', false],
      ['No', false],
      ['false', false],
      ['0', false],
      ['off', false],
      ['n', false],
    ])('should return false for "%s"', (input, expected) => {
      expect(convertToBoolean(input)).toBe(expected);
    });

    it('should return undefined for unrecognized values', () => {
      expect(convertToBoolean('maybe')).toBeUndefined();
      expect(convertToBoolean('2')).toBeUndefined();
    });
  });

  describe('convertBooleanToString', () => {
    it('should return "Yes" for true', () => {
      expect(convertBooleanToString(true)).toBe('Yes');
    });

    it('should return "No" for false', () => {
      expect(convertBooleanToString(false)).toBe('No');
    });

    it('should return empty string for undefined', () => {
      expect(convertBooleanToString(undefined)).toBe('');
    });
  });

  describe('isNumericValue', () => {
    it.each(['0', '1', '3.14', '-5', '0.001', '1e5'])('should return true for "%s"', (value) => {
      expect(isNumericValue(value)).toBe(true);
    });

    it.each(['', 'abc', '12abc', 'NaN'])('should return false for "%s"', (value) => {
      expect(isNumericValue(value)).toBe(false);
    });
  });

  describe('textToNumericValue', () => {
    it('should convert valid numeric strings', () => {
      expect(textToNumericValue('42')).toBe(42);
      expect(textToNumericValue('3.14')).toBe(3.14);
      expect(textToNumericValue('-10')).toBe(-10);
    });

    it('should return undefined for non-numeric strings', () => {
      expect(textToNumericValue('abc')).toBeUndefined();
      expect(textToNumericValue('')).toBeUndefined();
    });
  });

  describe('roundNumberToDecimalPlaces', () => {
    it('should round to 1 decimal place by default', () => {
      expect(roundNumberToDecimalPlaces(3.14)).toBe(3.1);
      expect(roundNumberToDecimalPlaces(3.15)).toBe(3.2);
      expect(roundNumberToDecimalPlaces(3.0)).toBe(3);
    });

    it('should round to specified decimal places', () => {
      expect(roundNumberToDecimalPlaces(3.14159, 2)).toBe(3.14);
      expect(roundNumberToDecimalPlaces(3.14159, 3)).toBe(3.142);
      expect(roundNumberToDecimalPlaces(3.14159, 0)).toBe(3);
    });

    it('should handle 0 correctly', () => {
      expect(roundNumberToDecimalPlaces(0, 2)).toBe(0);
    });
  });
});
