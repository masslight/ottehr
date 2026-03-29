import { describe, expect, it } from 'vitest';
import { cmToFeet, cmToFeetText, cmToInches, cmToInchesText, feetToCm, inchesToCm } from './vitals-height.helper';

describe('vitals-height.helper', () => {
  describe('cmToInches', () => {
    it('should convert cm to inches', () => {
      expect(cmToInches(2.54)).toBeCloseTo(1.0, 1);
      expect(cmToInches(30.48)).toBeCloseTo(12.0, 1);
    });

    it('should convert 0 cm to 0 inches', () => {
      expect(cmToInches(0)).toBe(0);
    });

    it('should round to 1 decimal place', () => {
      // 10 cm * 0.393701 = 3.93701 → 3.9
      expect(cmToInches(10)).toBe(3.9);
    });
  });

  describe('inchesToCm', () => {
    it('should convert inches to cm', () => {
      expect(inchesToCm(1)).toBeCloseTo(2.5, 1);
      expect(inchesToCm(12)).toBeCloseTo(30.5, 1);
    });

    it('should convert 0 inches to 0 cm', () => {
      expect(inchesToCm(0)).toBe(0);
    });
  });

  describe('cmToInches and inchesToCm are approximate inverses', () => {
    it('should round-trip approximately', () => {
      const original = 170;
      const inches = cmToInches(original);
      const backToCm = inchesToCm(inches);
      expect(backToCm).toBeCloseTo(original, 0);
    });
  });

  describe('cmToFeet', () => {
    it('should convert cm to feet', () => {
      // 30.48 cm = 1 foot
      expect(cmToFeet(30.48)).toBe(1);
      expect(cmToFeet(0)).toBe(0);
    });

    it('should round to 1 decimal place', () => {
      // 100 cm / 30.48 = 3.28084 → 3.3
      expect(cmToFeet(100)).toBe(3.3);
    });
  });

  describe('feetToCm', () => {
    it('should convert feet to cm via inches', () => {
      // 1 foot = 12 inches, inchesToCm(12) ≈ 30.5
      const result = feetToCm(1);
      expect(result).toBeCloseTo(30.5, 0);
    });

    it('should convert 0 feet to 0 cm', () => {
      expect(feetToCm(0)).toBe(0);
    });
  });

  describe('cmToInchesText', () => {
    it('should return string representation of inches', () => {
      expect(cmToInchesText(10)).toBe('3.9');
    });

    it('should return "0" for 0 cm', () => {
      expect(cmToInchesText(0)).toBe('0');
    });
  });

  describe('cmToFeetText', () => {
    it('should return string representation of feet', () => {
      expect(cmToFeetText(100)).toBe('3.3');
    });

    it('should return "0" for 0 cm', () => {
      expect(cmToFeetText(0)).toBe('0');
    });
  });
});
