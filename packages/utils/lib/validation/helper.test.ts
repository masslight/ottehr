import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getAgeInYears, isOlderThan18Years, isYoungerThan18Years } from './helper';

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
      expect(Math.floor(getAgeInYears('1995-01-01'))).toBe(31);
    });
  });

  describe('isYoungerThan18Years', () => {
    it('returns true for a patient under 18', () => {
      expect(isYoungerThan18Years('2009-06-03')).toBe(true);
    });

    it('returns true the day before the 18th birthday', () => {
      expect(isYoungerThan18Years('2008-06-04')).toBe(true);
    });

    it('returns false on the exact 18th birthday', () => {
      expect(isYoungerThan18Years('2008-06-03')).toBe(false);
    });

    it('returns false for a patient over 18', () => {
      expect(isYoungerThan18Years('1995-01-01')).toBe(false);
    });
  });

  describe('isOlderThan18Years', () => {
    it('returns false for a patient under 18', () => {
      expect(isOlderThan18Years('2009-06-03')).toBe(false);
    });

    it('returns false the day before the 18th birthday', () => {
      expect(isOlderThan18Years('2008-06-04')).toBe(false);
    });

    it('returns true, on the exact 18th birthday', () => {
      expect(isOlderThan18Years('2008-06-03')).toBe(true);
    });

    it('returns true for a patient over 18', () => {
      expect(isOlderThan18Years('1995-01-01')).toBe(true);
    });
  });
});
