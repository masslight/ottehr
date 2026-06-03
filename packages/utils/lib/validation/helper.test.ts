import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getAgeInYears, is18YearsOrYounger } from './helper';

describe('age helpers', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T12:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('getAgeInYears', () => {
    it('returns the patient age in whole years', () => {
      expect(getAgeInYears('1995-01-01')).toBe(31);
    });
  });

  describe('is18YearsOrYounger', () => {
    it('returns true for a patient under 18', () => {
      expect(is18YearsOrYounger('2009-06-03')).toBe(true);
    });

    it('returns true the day before the 18th birthday', () => {
      expect(is18YearsOrYounger('2008-06-04')).toBe(true);
    });

    it('returns true on the exact 18th birthday', () => {
      expect(is18YearsOrYounger('2008-06-03')).toBe(true);
    });

    it('returns true throughout the 18th year', () => {
      expect(is18YearsOrYounger('2007-07-03')).toBe(true);
    });

    it('returns false on the exact 19th birthday', () => {
      expect(is18YearsOrYounger('2007-06-03')).toBe(false);
    });

    it('returns false for a 31 year old', () => {
      expect(is18YearsOrYounger('1995-01-01')).toBe(false);
    });
  });
});
