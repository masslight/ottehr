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

  it('caps a dose at its per-dose maximum and measures it down to stay at or under it', () => {
    const dose = plainDose({
      weightKg: 28.12,
      mgPerMeasure: 80,
      measure: 'mL',
      basis: 'mg/kg/dose',
      rate: 25,
      dosesPerDay: 2,
      maxPerDoseMg: 500,
    });
    // 500 mg is 6.25 mL: the nearest half mL, 6.5 mL = 520 mg, would be over, so 6 mL.
    expect(dose).toEqual({
      amount: 6,
      amountText: '6 mL',
      working: '28.12 kg × 25 mg/kg/dose = 703 mg → capped at 500 mg per dose → 6 mL = 480 mg',
      roundingNote: '6 mL = 480 mg, 20 mg (4%) under 500 mg (rounded down to stay at or under the max 500 mg per dose)',
      capNote: 'Capped at the 500 mg maximum (703 mg by weight)',
    });
  });

  it('caps at a per-day maximum over the doses a day, the lower of the two maxima applying', () => {
    const dose = plainDose({
      weightKg: 28.12,
      mgPerMeasure: 250,
      measure: 'capsule',
      basis: 'mg/kg/day',
      rate: 90,
      dosesPerDay: 2,
      maxPerDoseMg: 2000,
      maxPerDayMg: 1000,
    });
    expect(dose?.amountText).toBe('2 capsules');
    expect(dose?.working).toBe(
      '28.12 kg × 90 mg/kg/day ÷ 2 = 1265.4 mg → capped at 1000 mg per day (500 mg per dose at 2 a day) → 2 capsules = 500 mg'
    );
    expect(dose?.roundingNote).toBeUndefined();
    expect(dose?.capNote).toBe('Capped at the 1,000 mg a day maximum (2,530.8 mg a day by weight)');
  });

  it('says a dose not by weight was capped as entered', () => {
    const dose = plainDose({ mgPerMeasure: 250, measure: 'capsule', basis: 'fixed', rate: 750, maxPerDoseMg: 500 });
    expect(dose?.amountText).toBe('2 capsules');
    expect(dose?.capNote).toBe('Capped at the 500 mg maximum (750 mg as entered)');
  });

  it('measures down when the nearest amount would go over a maximum the worked-out dose is under', () => {
    // 470 mg is 1.57 tablets: the nearest, 2 tablets = 600 mg, would be over 500 mg.
    const dose = plainDose({ mgPerMeasure: 300, measure: 'tablet', basis: 'fixed', rate: 470, maxPerDoseMg: 500 });
    expect(dose?.amountText).toBe('1 tablet');
    expect(dose?.working).toBe('470 mg → 1 tablet = 300 mg');
    expect(dose?.roundingNote).toBe(
      '1 tablet = 300 mg, 170 mg (36%) under 470 mg (rounded down to stay at or under the max 500 mg per dose)'
    );
    // Rounded down, but not capped: the dose worked out was under the maximum.
    expect(dose?.capNote).toBeUndefined();
  });

  it('leaves a dose under its maximum as it is, and waits for the doses a day a per-day maximum needs', () => {
    expect(
      plainDose({ weightKg: 10, mgPerMeasure: 80, measure: 'mL', basis: 'mg/kg/dose', rate: 25, maxPerDoseMg: 500 })
    ).toMatchObject({ amountText: '3 mL', working: '10 kg × 25 mg/kg/dose = 250 mg → 3 mL = 240 mg' });
    expect(
      plainDose({ weightKg: 10, mgPerMeasure: 80, measure: 'mL', basis: 'mg/kg/dose', rate: 25, maxPerDayMg: 1000 })
    ).toBeUndefined();
  });
});
