import { describe, expect, it } from 'vitest';
import { formatWeight, formatWeightKg, formatWeightLbs, kgToLbs, LBS_IN_KG } from './vitals-weight.helper';

describe('vitals-weight.helper', () => {
  describe('LBS_IN_KG constant', () => {
    it('should be the standard conversion factor', () => {
      expect(LBS_IN_KG).toBe(2.20462);
    });
  });

  describe('kgToLbs', () => {
    it('should convert kg to lbs', () => {
      expect(kgToLbs(1)).toBeCloseTo(2.2, 1);
      expect(kgToLbs(10)).toBeCloseTo(22.0, 1);
    });

    it('should convert 0 kg to 0 lbs', () => {
      expect(kgToLbs(0)).toBe(0);
    });

    it('should round to 1 decimal place', () => {
      // 3 kg * 2.20462 = 6.61386 → 6.6
      expect(kgToLbs(3)).toBe(6.6);
    });
  });

  describe('formatWeightKg', () => {
    it('should format weight in kg as string', () => {
      expect(formatWeightKg(5)).toBe('5');
      expect(formatWeightKg(5.55)).toBe('5.6');
    });
  });

  describe('formatWeightLbs', () => {
    it('should convert kg input to lbs and format', () => {
      // 10 kg * 2.20462 = 22.0462 → rounded to 1 decimal → 22
      expect(formatWeightLbs(10)).toBe('22');
    });

    it('should handle fractional kg', () => {
      // 3.5 kg * 2.20462 = 7.71617 → 7.7
      expect(formatWeightLbs(3.5)).toBe('7.7');
    });
  });

  describe('formatWeight', () => {
    it('should return kg value as string when unit is kg', () => {
      expect(formatWeight(5, 'kg')).toBe('5');
    });

    it('should convert and return lbs value when unit is lbs', () => {
      expect(formatWeight(10, 'lbs')).toBe('22');
    });
  });
});
