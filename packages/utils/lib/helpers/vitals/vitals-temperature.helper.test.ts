import { describe, expect, it } from 'vitest';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  roundTemperatureForSave,
  roundTemperatureValue,
} from './vitals-temperature.helper';

describe('vitals-temperature.helper', () => {
  describe('roundTemperatureValue', () => {
    it('should round to 1 decimal place', () => {
      expect(roundTemperatureValue(98.64)).toBe(98.6);
      expect(roundTemperatureValue(98.65)).toBe(98.7);
      expect(roundTemperatureValue(37.0)).toBe(37);
    });
  });

  describe('roundTemperatureForSave', () => {
    it('should round to 3 decimal places', () => {
      expect(roundTemperatureForSave(98.12345)).toBe(98.123);
      expect(roundTemperatureForSave(98.12355)).toBe(98.124);
    });
  });

  describe('celsiusToFahrenheit', () => {
    it('should convert known values correctly', () => {
      // 0°C = 32°F
      expect(celsiusToFahrenheit(0)).toBe(32);
      // 100°C = 212°F
      expect(celsiusToFahrenheit(100)).toBe(212);
      // 37°C ≈ 98.6°F
      expect(celsiusToFahrenheit(37)).toBeCloseTo(98.6, 1);
    });
  });

  describe('fahrenheitToCelsius', () => {
    it('should convert known values correctly', () => {
      // 32°F = 0°C
      expect(fahrenheitToCelsius(32)).toBe(0);
      // 212°F = 100°C
      expect(fahrenheitToCelsius(212)).toBe(100);
      // 98.6°F ≈ 37°C
      expect(fahrenheitToCelsius(98.6)).toBeCloseTo(37, 1);
    });
  });

  describe('celsius/fahrenheit round-trip', () => {
    it('should approximately round-trip', () => {
      const original = 37.5;
      const f = celsiusToFahrenheit(original);
      const backToC = fahrenheitToCelsius(f);
      expect(backToC).toBeCloseTo(original, 1);
    });
  });
});
