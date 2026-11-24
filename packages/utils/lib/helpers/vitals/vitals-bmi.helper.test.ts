import { Settings } from 'luxon';
import { afterEach, describe, expect, it } from 'vitest';
import { VitalFieldNames } from '../../types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from '../../types/api/chart-data/chart-data.types';
import {
  areVitalsSameDay,
  BMI_DISPLAY_PRECISION,
  bmiAppliesOnDate,
  calculateBMI,
  formatBMI,
  withoutBMIUnder24Months,
} from './vitals-bmi.helper';

describe('vitals-bmi.helper', () => {
  describe('BMI_DISPLAY_PRECISION', () => {
    it('is 1 decimal place', () => {
      expect(BMI_DISPLAY_PRECISION).toBe(1);
    });
  });

  describe('calculateBMI', () => {
    // Formula: weight_kg / (height_cm / 100)^2

    it('calculates BMI correctly for a normal-weight adult', () => {
      // 70 kg, 175 cm → 70 / 1.75² = 70 / 3.0625 ≈ 22.857 → 22.9
      expect(calculateBMI(70, 175)).toBe(22.9);
    });

    it('calculates BMI correctly for an underweight case', () => {
      // 50 kg, 170 cm → 50 / 1.70² = 50 / 2.89 ≈ 17.301 → 17.3
      expect(calculateBMI(50, 170)).toBe(17.3);
    });

    it('calculates BMI correctly for an overweight case', () => {
      // 90 kg, 175 cm → 90 / 1.75² ≈ 29.388 → 29.4
      expect(calculateBMI(90, 175)).toBe(29.4);
    });

    it('calculates BMI correctly for an obese case', () => {
      // 120 kg, 175 cm → 120 / 1.75² ≈ 39.184 → 39.2
      expect(calculateBMI(120, 175)).toBe(39.2);
    });

    it('rounds up when the second decimal digit is >= 5', () => {
      // 70 kg, 175 cm → exact 22.857..., second digit = 5 → rounds up to 22.9
      expect(calculateBMI(70, 175)).toBe(22.9);
    });

    it('rounds down when the second decimal digit is < 5', () => {
      // 50 kg, 160 cm → 50 / 1.60² = 50 / 2.56 ≈ 19.531 → 19.5
      expect(calculateBMI(50, 160)).toBe(19.5);
    });

    it('accepts height in centimetres (not metres)', () => {
      // Same person: 70 kg at 175 cm → 22.9; calling with 1.75 would give 22857.1
      expect(calculateBMI(70, 175)).toBe(22.9);
      expect(calculateBMI(70, 1.75)).not.toBe(22.9);
    });

    it('accepts weight in kilograms', () => {
      // 70 kg = 154.3 lbs; only the metric value produces the correct BMI
      expect(calculateBMI(70, 175)).toBe(22.9);
    });

    it('returns a number', () => {
      expect(typeof calculateBMI(70, 175)).toBe('number');
    });

    it('always returns at most 1 decimal place of precision', () => {
      const result = calculateBMI(70, 175);
      const decimals = (result.toString().split('.')[1] ?? '').length;
      expect(decimals).toBeLessThanOrEqual(1);
    });

    it('handles a short child height correctly', () => {
      // 40 kg, 120 cm → 40 / 1.20² = 40 / 1.44 ≈ 27.778 → 27.8
      expect(calculateBMI(40, 120)).toBe(27.8);
    });

    it('handles a tall adult correctly', () => {
      // 80 kg, 200 cm → 80 / 2.00² = 80 / 4 = 20.0
      expect(calculateBMI(80, 200)).toBe(20);
    });
  });

  describe('formatBMI', () => {
    it('formats a value with one decimal place', () => {
      expect(formatBMI(24.3)).toBe('24.3');
    });

    it('adds a trailing zero for integer BMI values', () => {
      expect(formatBMI(25)).toBe('25.0');
    });

    it('formats zero correctly', () => {
      expect(formatBMI(0)).toBe('0.0');
    });

    it('returns a string', () => {
      expect(typeof formatBMI(24.3)).toBe('string');
    });

    it('formats the result of calculateBMI correctly', () => {
      // 70 kg, 175 cm → calculateBMI returns 22.9 → "22.9"
      expect(formatBMI(calculateBMI(70, 175))).toBe('22.9');
    });

    it('formats calculateBMI result for an underweight case', () => {
      // 50 kg, 170 cm → 17.3 → "17.3"
      expect(formatBMI(calculateBMI(50, 170))).toBe('17.3');
    });
  });

  describe('areVitalsSameDay', () => {
    it('returns true for two timestamps on the same UTC day', () => {
      expect(areVitalsSameDay('2026-07-10T08:00:00Z', '2026-07-10T22:30:00Z')).toBe(true);
    });

    it('returns false when the readings are on different days (e.g. weight today, height months ago)', () => {
      // The reported bug: weight from 7/10, height from 2/24 must not produce a BMI.
      expect(areVitalsSameDay('2026-07-10T08:00:00Z', '2024-02-24T09:00:00Z')).toBe(false);
    });

    it('returns false for consecutive days (yesterday vs today)', () => {
      expect(areVitalsSameDay('2026-07-10T23:59:00Z', '2026-07-09T23:59:00Z')).toBe(false);
    });

    it('compares in UTC', () => {
      // Same instant expressed with an offset resolves to the same UTC day.
      expect(areVitalsSameDay('2026-07-10T02:00:00+03:00', '2026-07-09T23:30:00Z')).toBe(true);
    });

    it('returns false when either timestamp is missing', () => {
      expect(areVitalsSameDay(undefined, '2026-07-10T08:00:00Z')).toBe(false);
      expect(areVitalsSameDay('2026-07-10T08:00:00Z', undefined)).toBe(false);
      expect(areVitalsSameDay(undefined, undefined)).toBe(false);
    });
  });

  describe('refused weight handling (documented behaviour)', () => {
    // When a patient refuses weight, VitalsWeightObservationDTO.value is undefined.
    // saveBMI in useVitalsManagement guards with: if (!weightKg || !heightCm) return false;
    // calculateBMI is therefore never called with an undefined weight.
    // This test documents what would happen if the guard were missing.
    it('returns 0.0 for zero weight — illustrating why the caller must guard against undefined/0 weight', () => {
      expect(calculateBMI(0, 175)).toBe(0);
    });
  });
});

describe('BMI under 24 months', () => {
  const reading = (field: VitalFieldNames, lastUpdated: string): VitalsObservationDTO =>
    ({ field, value: 17.7, lastUpdated }) as VitalsObservationDTO;

  const clinicZone = 'America/New_York';
  const runtimeZone = Settings.defaultZone;
  afterEach(() => {
    Settings.defaultZone = runtimeZone;
  });

  it('applies from the second birthday at the visit, and when the age is unknown', () => {
    expect(bmiAppliesOnDate('2024-11-21', '2026-11-20T15:00:00Z', clinicZone)).toBe(false);
    expect(bmiAppliesOnDate('2024-11-20', '2026-11-20T15:00:00Z', clinicZone)).toBe(true);
    expect(bmiAppliesOnDate(undefined, '2026-11-20T15:00:00Z', clinicZone)).toBe(true);
  });

  it.each(['utc', 'America/New_York', 'Asia/Tokyo'])(
    'counts the second birthday on the clinic calendar when the code runs in %s',
    (zone) => {
      Settings.defaultZone = zone;
      const halfPastMidnightUtc = '2026-11-21T00:30:00Z';

      expect(bmiAppliesOnDate('2024-11-21', halfPastMidnightUtc, 'America/New_York')).toBe(false);
      expect(bmiAppliesOnDate('2024-11-21', halfPastMidnightUtc, 'Europe/London')).toBe(true);
    }
  );

  it('drops every BMI of a visit when the patient was under 24 months, keeping the other vitals', () => {
    const vitals = [
      reading(VitalFieldNames.VitalBMI, '2026-11-20T15:00:00Z'),
      reading(VitalFieldNames.VitalWeight, '2026-11-20T15:00:00Z'),
    ];

    expect(withoutBMIUnder24Months(vitals, '2025-01-01', clinicZone, '2026-11-20T15:00:00Z')).toEqual([vitals[1]]);
    expect(withoutBMIUnder24Months(vitals, '2020-01-01', clinicZone, '2026-11-20T15:00:00Z')).toEqual(vitals);
  });

  it('judges each reading by its own date when no visit date is given', () => {
    const infantBMI = reading(VitalFieldNames.VitalBMI, '2025-06-01T15:00:00Z');
    const toddlerBMI = reading(VitalFieldNames.VitalBMI, '2026-11-01T15:00:00Z');

    expect(withoutBMIUnder24Months([infantBMI, toddlerBMI], '2024-06-01', clinicZone)).toEqual([toddlerBMI]);
  });
});
