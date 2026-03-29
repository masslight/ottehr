import { DateTime, Settings } from 'luxon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  calculatePatientAge,
  compareDates,
  convertCapacityMapToSlotList,
  formatDateConfigurable,
  formatDateForDisplay,
  isISODateTime,
} from './dateUtils';

describe('dateUtils', () => {
  describe('isISODateTime', () => {
    it('should return true for valid ISO strings', () => {
      expect(isISODateTime('2025-06-15')).toBe(true);
      expect(isISODateTime('2025-06-15T14:00:00Z')).toBe(true);
      expect(isISODateTime('2025-06-15T14:00:00-04:00')).toBe(true);
    });

    it('should return false for invalid strings', () => {
      expect(isISODateTime('not-a-date')).toBe(false);
      expect(isISODateTime('')).toBe(false);
    });
  });

  describe('calculatePatientAge', () => {
    let originalNow: typeof Settings.now;

    beforeEach(() => {
      originalNow = Settings.now;
      // Fix now to June 15, 2025
      Settings.now = () => Date.UTC(2025, 5, 15);
    });

    afterEach(() => {
      Settings.now = originalNow;
    });

    it('should return null for null input', () => {
      expect(calculatePatientAge(null)).toBeNull();
    });

    it('should return undefined for undefined input', () => {
      expect(calculatePatientAge(undefined)).toBeUndefined();
    });

    it('should return empty string for invalid date', () => {
      expect(calculatePatientAge('not-a-date')).toBe('');
    });

    it('should return years for patients >= 2 years old', () => {
      expect(calculatePatientAge('2020-06-15')).toBe('5 y');
      expect(calculatePatientAge('2023-06-14')).toBe('2 y');
    });

    it('should return months for patients >= 2 months but < 2 years', () => {
      expect(calculatePatientAge('2025-01-15')).toBe('5 m');
      expect(calculatePatientAge('2025-04-14')).toBe('2 m');
    });

    it('should return days for patients < 2 months old', () => {
      expect(calculatePatientAge('2025-06-01')).toBe('14 d');
    });

    it('should return "0 d" for future dates', () => {
      expect(calculatePatientAge('2026-01-01')).toBe('0 d');
    });
  });

  describe('convertCapacityMapToSlotList', () => {
    it('should expand capacity map into repeated time slots', () => {
      const map = {
        '2025-06-15T08:00:00Z': 2,
        '2025-06-15T09:00:00Z': 1,
      };
      const result = convertCapacityMapToSlotList(map);
      expect(result).toHaveLength(3);
      expect(result.filter((s) => s === '2025-06-15T08:00:00Z')).toHaveLength(2);
      expect(result.filter((s) => s === '2025-06-15T09:00:00Z')).toHaveLength(1);
    });

    it('should return empty array for empty map', () => {
      expect(convertCapacityMapToSlotList({})).toEqual([]);
    });

    it('should handle zero capacity', () => {
      const map = { '2025-06-15T08:00:00Z': 0 };
      expect(convertCapacityMapToSlotList(map)).toEqual([]);
    });
  });

  describe('formatDateForDisplay', () => {
    it('should format date as MM/dd/yyyy', () => {
      expect(formatDateForDisplay('2025-06-15')).toBe('06/15/2025');
    });

    it('should return empty string for undefined', () => {
      expect(formatDateForDisplay(undefined)).toBe('');
    });

    it('should return empty string for invalid date', () => {
      expect(formatDateForDisplay('invalid')).toBe('');
    });

    it('should apply timezone when provided', () => {
      const result = formatDateForDisplay('2025-06-15T23:00:00-04:00', 'UTC');
      // 23:00 ET = 03:00 UTC next day
      expect(result).toBe('06/16/2025');
    });
  });

  describe('compareDates', () => {
    it('should sort most recent date first', () => {
      expect(compareDates('2025-06-15', '2025-06-10')).toBeLessThan(0);
    });

    it('should put valid dates before invalid ones', () => {
      expect(compareDates('2025-06-15', undefined)).toBe(-1);
      expect(compareDates(undefined, '2025-06-15')).toBe(1);
    });

    it('should treat two invalid dates as equal', () => {
      expect(compareDates(undefined, undefined)).toBe(0);
    });

    it('should return 0 for equal dates', () => {
      expect(compareDates('2025-06-15', '2025-06-15')).toBe(0);
    });
  });

  describe('formatDateConfigurable', () => {
    it('should format from isoDate', () => {
      expect(formatDateConfigurable({ isoDate: '2025-06-15' })).toBe('06/15/2025');
    });

    it('should format from DateTime', () => {
      const dt = DateTime.fromISO('2025-06-15');
      expect(formatDateConfigurable({ date: dt })).toBe('06/15/2025');
    });

    it('should use custom format', () => {
      expect(formatDateConfigurable({ isoDate: '2025-06-15', format: 'yyyy' })).toBe('2025');
    });

    it('should return undefined for missing input', () => {
      expect(formatDateConfigurable({})).toBeUndefined();
    });
  });
});
