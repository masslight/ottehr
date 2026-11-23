import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { ageInMonthsOnDate, isPediatricOnDate } from './dateUtils';

describe('isPediatricOnDate', () => {
  it('is true under 18 on the date and false from the 18th birthday on', () => {
    expect(isPediatricOnDate('2010-06-15', '2026-09-30T12:00:00Z')).toBe(true);
    // The day before the 18th birthday still counts as a child.
    expect(isPediatricOnDate('2008-10-01', '2026-09-30T12:00:00Z')).toBe(true);
    expect(isPediatricOnDate('2008-09-30', '2026-09-30T12:00:00Z')).toBe(false);
  });

  it('defaults to today when no date is given', () => {
    expect(isPediatricOnDate(DateTime.now().minus({ years: 17, months: 11 }).toISODate()!)).toBe(true);
    expect(isPediatricOnDate(DateTime.now().minus({ years: 18, days: 1 }).toISODate()!)).toBe(false);
  });

  it('accepts partial FHIR birth dates (year, year-month)', () => {
    expect(isPediatricOnDate('2010', '2026-09-30')).toBe(true);
    expect(isPediatricOnDate('2010-06', '2026-09-30')).toBe(true);
    expect(isPediatricOnDate('2000', '2026-09-30')).toBe(false);
  });

  it('counts a missing or unparsable birth date as adult', () => {
    expect(isPediatricOnDate(undefined, '2026-09-30')).toBe(false);
    expect(isPediatricOnDate('', '2026-09-30')).toBe(false);
    expect(isPediatricOnDate('not-a-date', '2026-09-30')).toBe(false);
    expect(isPediatricOnDate('2010-06-15', 'not-a-date')).toBe(false);
  });
});

describe('ageInMonthsOnDate', () => {
  it('measures the age on the given date, reaching 24 months on the second birthday', () => {
    expect(ageInMonthsOnDate('2024-11-20', '2026-11-20T09:30:00-05:00')).toBeGreaterThanOrEqual(24);
    expect(ageInMonthsOnDate('2024-11-21', '2026-11-20T09:30:00-05:00')).toBeLessThan(24);
    expect(ageInMonthsOnDate('2025-05-14', '2025-11-14')).toBe(6);
  });

  it('defaults to today when no date is given', () => {
    expect(ageInMonthsOnDate(DateTime.now().minus({ months: 3 }).toISODate()!)).toBeCloseTo(3, 0);
  });

  it('is unknown for a missing or unparsable date', () => {
    expect(ageInMonthsOnDate(undefined, '2026-09-30')).toBeUndefined();
    expect(ageInMonthsOnDate('not-a-date', '2026-09-30')).toBeUndefined();
    expect(ageInMonthsOnDate('2025-01-01', 'not-a-date')).toBeUndefined();
  });
});
