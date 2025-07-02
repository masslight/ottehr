import { DateTime } from 'luxon';
import { calculatePatientAge } from 'utils';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  datesCompareFn,
  formatDateUsingSlashes,
  formatHourNumber,
  formatISODateToLocaleDate,
  formatISOStringToDateAndTime,
  getTimezone,
} from './formatDateTime';

describe('calculatePatientAge', () => {
  const dateNow = DateTime.fromISO('2024-01-01T00:00:00.000Z');

  const getDateString = (yearsAgo: number, monthsAgo = 0, daysAgo = 0): string | null => {
    return dateNow.minus({ years: yearsAgo, months: monthsAgo, days: daysAgo }).toISODate();
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(dateNow.toJSDate());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should return empty string for null or undefined input', () => {
    expect(calculatePatientAge(null)).toBe(null);
    expect(calculatePatientAge(undefined)).toBe(undefined);
  });

  it('should return empty string for invalid date', () => {
    expect(calculatePatientAge('invalid-date')).toBe('');
  });

  it('should return age in years if 2 years or older', () => {
    expect(calculatePatientAge(getDateString(2))).toBe('2 y');
    expect(calculatePatientAge(getDateString(4))).toBe('4 y');
  });

  it('should return age in months if between 2 months and 2 years', () => {
    expect(calculatePatientAge(getDateString(0, 2))).toBe('2 m');
    expect(calculatePatientAge(getDateString(1, 7))).toBe('19 m');
  });

  it('should return age in days if less than 2 months', () => {
    expect(calculatePatientAge(getDateString(0, 0, 1))).toBe('1 d');
    expect(calculatePatientAge(getDateString(0, 0, 30))).toBe('30 d');
  });

  it('should handle edge cases around year and month boundaries', () => {
    expect(calculatePatientAge(getDateString(1, 11, 10))).toBe('23 m');
    expect(calculatePatientAge(getDateString(0, 1, 28))).toBe('59 d');
  });

  it('should handle future dates', () => {
    expect(calculatePatientAge(getDateString(-1))).toBe('0 d');
  });
});

describe('formatDateTime helpers', () => {
  describe('formatHourNumber', () => {
    it('should format hour number correctly', () => {
      expect(formatHourNumber(0)).toBe('12 AM');
      expect(formatHourNumber(1)).toBe('1 AM');
      expect(formatHourNumber(12)).toBe('12 PM');
      expect(formatHourNumber(13)).toBe('1 PM');
    });

    it('should handle edge cases', () => {
      expect(formatHourNumber(-1)).toBe('Invalid DateTime');
      expect(formatHourNumber(25)).toBe('Invalid DateTime');
    });
  });

  describe('formatDateUsingSlashes', () => {
    it('should format date using slashes', () => {
      expect(formatDateUsingSlashes('2023-05-15')).toBe('05/15/2023');
    });

    it('should return undefined for undefined input', () => {
      expect(formatDateUsingSlashes(undefined)).toBeUndefined();
    });

    it('should handle invalid date strings', () => {
      expect(formatDateUsingSlashes('invalid-date')).toBe('Invalid DateTime');
    });
  });

  describe('datesCompareFn', () => {
    const compareFn = datesCompareFn('MM/dd/yyyy');

    it('should compare dates correctly', () => {
      expect(compareFn('05/15/2023', '05/16/2023')).toBeLessThan(0);
      expect(compareFn('05/16/2023', '05/15/2023')).toBeGreaterThan(0);
      expect(compareFn('05/15/2023', '05/15/2023')).toBe(0);
      expect(compareFn('12/31/2023', '01/01/2024')).toBeLessThan(0);
    });

    it('should handle invalid date strings', () => {
      expect(compareFn('invalid', '05/15/2023')).toBeNaN();
      expect(compareFn('05/15/2023', 'invalid')).toBeNaN();
    });
  });

  describe('formatISODateToLocaleDate', () => {
    it('should format ISO date to locale date', () => {
      expect(formatISODateToLocaleDate('2023-05-15')).toBe('May 15, 2023');
      expect(formatISODateToLocaleDate('2023-12-31')).toBe('Dec 31, 2023');
      expect(formatISODateToLocaleDate('2023-01-01')).toBe('Jan 01, 2023');
    });

    it('should return undefined for undefined input', () => {
      expect(formatISODateToLocaleDate(undefined)).toBeUndefined();
    });

    it('should handle invalid date strings', () => {
      expect(formatISODateToLocaleDate('invalid-date')).toBe('Invalid DateTime');
    });
  });

  describe('formatISOStringToDateAndTime', () => {
    it('should format ISO string to date and time', () => {
      expect(formatISOStringToDateAndTime('2023-05-15T14:30:00')).toBe('05/15/2023, 14:30');
      expect(formatISOStringToDateAndTime('2023-12-31T23:59:59')).toBe('12/31/2023, 23:59');
      expect(formatISOStringToDateAndTime('2023-01-01T00:00:00')).toBe('01/01/2023, 00:00');
    });

    it('should handle invalid ISO strings', () => {
      expect(formatISOStringToDateAndTime('invalid')).toBe('Invalid DateTime');
    });
  });

  describe('getTimezone', () => {
    it('should return default timezone if location is undefined', () => {
      expect(getTimezone(undefined)).toBe('America/New_York');
    });

    it('should return timezone from location extension', () => {
      const location = {
        extension: [
          {
            url: 'http://hl7.org/fhir/StructureDefinition/timezone',
            valueString: 'Europe/London',
          },
        ],
      };
      expect(getTimezone(location as any)).toBe('Europe/London');
    });

    it('should return default timezone if extension is not found', () => {
      const location = {
        extension: [
          {
            url: 'some-other-url',
            valueString: 'Europe/London',
          },
        ],
      };
      expect(getTimezone(location as any)).toBe('America/New_York');
    });

    it('should return default timezone if extension array is empty', () => {
      const location = { extension: [] };
      expect(getTimezone(location as any)).toBe('America/New_York');
    });
  });
});
