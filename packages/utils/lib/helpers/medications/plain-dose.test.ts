import { describe, expect, it } from 'vitest';
import { plainDose } from './plain-dose';

describe('plainDose', () => {
  it('works out a per-dose rate, rounds to whole capsules and notes how far over it is', () => {
    expect(
      plainDose({ weightKg: 28.12, mgPerMeasure: 250, measure: 'capsule', basis: 'mg/kg/dose', rate: 25 })
    ).toEqual({
      amount: 3,
      amountText: '3 capsules',
      working: '28.12 kg × 25 mg/kg/dose = 703 mg → 3 capsules = 750 mg',
      roundingNote: '3 capsules = 750 mg, 47 mg (7%) over 703 mg',
    });
  });

  it('splits a per-day rate over the doses a day and measures a liquid to the half mL', () => {
    const dose = plainDose({
      weightKg: 28.12,
      mgPerMeasure: 80,
      measure: 'mL',
      basis: 'mg/kg/day',
      rate: 25,
      dosesPerDay: 2,
    });
    expect(dose?.working).toBe('28.12 kg × 25 mg/kg/day ÷ 2 = 351.5 mg → 4.5 mL = 360 mg');
    expect(dose?.roundingNote).toBe('4.5 mL = 360 mg, 8.5 mg (2%) over 351.5 mg');
  });

  it('notes a dose measured under, and says nothing when the dose measures exactly', () => {
    expect(plainDose({ mgPerMeasure: 500, measure: 'capsule', basis: 'fixed', rate: 703 })?.roundingNote).toBe(
      '1 capsule = 500 mg, 203 mg (29%) under 703 mg'
    );
    expect(plainDose({ mgPerMeasure: 250, measure: 'tablet', basis: 'fixed', rate: 500 })).toMatchObject({
      amountText: '2 tablets',
      roundingNote: undefined,
    });
  });

  it('waits for the weight, strength, rate and doses a day it needs', () => {
    expect(
      plainDose({ mgPerMeasure: 80, measure: 'mL', basis: 'mg/kg/day', rate: 25, dosesPerDay: 2 })
    ).toBeUndefined();
    expect(plainDose({ weightKg: 20, measure: 'mL', basis: 'mg/kg/dose', rate: 25 })).toBeUndefined();
    expect(plainDose({ weightKg: 20, mgPerMeasure: 80, measure: 'mL', basis: 'mg/kg/day', rate: 25 })).toBeUndefined();
  });
});
