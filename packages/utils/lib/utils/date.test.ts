import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  createDateTimeInET,
  createLocalDateTime,
  formatDate,
  formatDateForFHIR,
  formatDateTimeToLocaleString,
  formatDateToMDYWithTime,
  formatVisitDate,
  generateYyyyMmDdString,
  getDateComponentsFromISOString,
  getDateTimeFromDateAndTime,
  isHoliday,
  isoStringFromMDYString,
  isoStringFromYMDString,
  mdyStringFromISOString,
  removeTimeFromDate,
  tryFormatDateToISO,
} from './date';

describe('date utilities', () => {
  describe('generateYyyyMmDdString', () => {
    it('should concatenate year, month, day with dashes', () => {
      expect(generateYyyyMmDdString('2025', '01', '15')).toBe('2025-01-15');
    });
  });

  describe('removeTimeFromDate', () => {
    it('should strip time portion', () => {
      expect(removeTimeFromDate('2025-01-15T14:30:00Z')).toBe('2025-01-15');
    });

    it('should return date-only strings unchanged', () => {
      expect(removeTimeFromDate('2025-01-15')).toBe('2025-01-15');
    });
  });

  describe('createDateTimeInET', () => {
    it('should create DateTime in Eastern timezone', () => {
      const dt = createDateTimeInET('2025-06-15T12:00:00');
      expect(dt.zoneName).toBe('America/New_York');
    });
  });

  describe('createLocalDateTime', () => {
    it('should convert ISO string to given timezone', () => {
      const result = createLocalDateTime('2025-06-15T18:00:00Z', 'America/New_York');
      expect(result).toBeDefined();
      expect(result?.zoneName).toBe('America/New_York');
    });

    it('should convert DateTime to given timezone', () => {
      const dt = DateTime.fromISO('2025-06-15T18:00:00Z');
      const result = createLocalDateTime(dt, 'America/Chicago');
      expect(result?.zoneName).toBe('America/Chicago');
    });

    it('should return undefined for undefined input', () => {
      expect(createLocalDateTime(undefined)).toBeUndefined();
    });

    it('should return undefined for invalid date string', () => {
      expect(createLocalDateTime('not-a-date')).toBeUndefined();
    });

    it('should default to America/New_York timezone', () => {
      const result = createLocalDateTime('2025-06-15T18:00:00Z');
      expect(result?.zoneName).toBe('America/New_York');
    });
  });

  describe('isoStringFromMDYString', () => {
    it('should convert MM/dd/yyyy to yyyy-MM-dd', () => {
      expect(isoStringFromMDYString('01/15/2025')).toBe('2025-01-15');
      expect(isoStringFromMDYString('12/31/2000')).toBe('2000-12-31');
    });

    it('should return yyyy-MM-dd strings as-is', () => {
      expect(isoStringFromMDYString('2025-01-15')).toBe('2025-01-15');
    });

    it('should throw for invalid format', () => {
      expect(() => isoStringFromMDYString('invalid')).toThrow();
    });
  });

  describe('mdyStringFromISOString', () => {
    it('should convert yyyy-MM-dd to MM/dd/yyyy', () => {
      expect(mdyStringFromISOString('2025-01-15')).toBe('01/15/2025');
    });

    it('should handle ISO strings with time', () => {
      expect(mdyStringFromISOString('2025-01-15T14:00:00Z')).toBe('01/15/2025');
    });

    it('should return MM/dd/yyyy strings as-is', () => {
      expect(mdyStringFromISOString('01/15/2025')).toBe('01/15/2025');
    });

    it('should throw for invalid format', () => {
      expect(() => mdyStringFromISOString('invalid')).toThrow();
    });
  });

  describe('isoStringFromYMDString', () => {
    it('should convert MM/dd/yyyy to ISO date', () => {
      expect(isoStringFromYMDString('01/15/2025')).toBe('2025-01-15');
    });

    it('should handle yyyy-MM-dd format', () => {
      expect(isoStringFromYMDString('2025-01-15')).toBe('2025-01-15');
    });
  });

  describe('formatDateForFHIR', () => {
    it('should convert MM/dd/yyyy to yyyy-MM-dd', () => {
      expect(formatDateForFHIR('1/5/2025')).toBe('2025-01-05');
    });
  });

  describe('formatDate', () => {
    it('should format DateTime with custom format', () => {
      const dt = DateTime.fromISO('2025-06-15');
      expect(formatDate(dt, 'MM/dd/yyyy')).toBe('06/15/2025');
    });

    it('should format ISO string', () => {
      expect(formatDate('2025-06-15', 'MM/dd/yyyy')).toBe('06/15/2025');
    });

    it('should return ISO string when no format specified', () => {
      const result = formatDate('2025-06-15');
      expect(result).toContain('2025-06-15');
    });

    it('should return fallback for invalid date', () => {
      expect(formatDate('not-a-date')).toBe('-');
      expect(formatDate('')).toBe('-');
    });

    it('should return fallback for invalid DateTime', () => {
      expect(formatDate(DateTime.invalid('test'))).toBe('-');
    });
  });

  describe('getDateTimeFromDateAndTime', () => {
    it('should set hour on date and start of hour', () => {
      const date = DateTime.fromISO('2025-06-15T14:30:00');
      const result = getDateTimeFromDateAndTime(date, 10);
      expect(result.hour).toBe(10);
      expect(result.minute).toBe(0);
    });
  });

  describe('getDateComponentsFromISOString', () => {
    it('should parse yyyy-MM-dd into components', () => {
      const result = getDateComponentsFromISOString('2025-01-05');
      expect(result.year).toBe('2025');
      expect(result.month).toBe('01');
      expect(result.day).toBe('05');
    });

    it('should pad single-digit months and days', () => {
      const result = getDateComponentsFromISOString('2025-01-05');
      expect(result.month).toBe('01');
      expect(result.day).toBe('05');
    });

    it('should return empty strings for undefined', () => {
      const result = getDateComponentsFromISOString(undefined);
      expect(result.year).toBe('');
      expect(result.month).toBe('');
      expect(result.day).toBe('');
    });
  });

  describe('tryFormatDateToISO', () => {
    it('should format valid date', () => {
      const dt = DateTime.fromISO('2025-06-15');
      expect(tryFormatDateToISO(dt)).toBe('2025-06-15');
    });

    it('should return undefined for null', () => {
      expect(tryFormatDateToISO(null)).toBeUndefined();
    });

    it('should return undefined for invalid DateTime', () => {
      expect(tryFormatDateToISO(DateTime.invalid('test'))).toBeUndefined();
    });
  });

  describe('formatVisitDate', () => {
    it('should format with birth format', () => {
      const result = formatVisitDate('2025-06-15', 'birth');
      expect(result).toContain('June');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('should return raw string for unknown format', () => {
      expect(formatVisitDate('2025-06-15', 'unknown')).toBe('2025-06-15');
    });
  });

  describe('isHoliday', () => {
    it('should return true for a holiday date', () => {
      const holidays = { 2025: new Set(['2025-12-25']) };
      const date = DateTime.fromISO('2025-12-25');
      expect(isHoliday(date, holidays)).toBe(true);
    });

    it('should return false for a non-holiday date', () => {
      const holidays = { 2025: new Set(['2025-12-25']) };
      const date = DateTime.fromISO('2025-12-24');
      expect(isHoliday(date, holidays)).toBe(false);
    });

    it('should return false for year not in holidays', () => {
      const holidays = { 2025: new Set(['2025-12-25']) };
      const date = DateTime.fromISO('2024-12-25');
      expect(isHoliday(date, holidays)).toBe(false);
    });
  });

  describe('formatDateTimeToLocaleString', () => {
    it('should return empty string for empty input', () => {
      expect(formatDateTimeToLocaleString('', 'date')).toBe('');
    });

    it('should format as date', () => {
      const result = formatDateTimeToLocaleString('2025-06-15T14:00:00Z', 'date');
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format as datetime with timezone', () => {
      const result = formatDateTimeToLocaleString('2025-06-15T14:00:00Z', 'datetime', 'America/New_York');
      expect(result).toBeTruthy();
    });
  });

  describe('formatDateToMDYWithTime', () => {
    it('should return undefined for undefined input', () => {
      expect(formatDateToMDYWithTime(undefined)).toBeUndefined();
    });

    it('should return date and time parts', () => {
      const result = formatDateToMDYWithTime('2025-06-15T14:30:00Z', 'UTC');
      expect(result).toBeDefined();
      expect(result?.date).toBe('06/15/2025');
      expect(result?.time).toBe('02:30 PM');
    });
  });
});
