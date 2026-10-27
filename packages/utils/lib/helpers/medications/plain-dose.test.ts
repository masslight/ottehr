import { describe, expect, it } from 'vitest';
import { plainDose } from './plain-dose';

describe('plainDose', () => {
  it('works out a per-dose rate, rounds to whole capsules and notes how far over it is', () => {
    expect(
      plainDose({ weightKg: 28.12, mgPerMeasure: 250, measure: 'capsule', basis: 'mg/kg/dose', rate: 25 })
    ).toEqual({
      amount: 3,
      amountText: '3 capsules',
      working: '28.12 kg × 25 mg/kg/dose = 703 mg',
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
    expect(dose?.working).toBe('28.12 kg × 25 mg/kg/day ÷ 2 = 351.5 mg');
    expect(dose?.roundingNote).toBe('4.5 mL = 360 mg, 8.5 mg (2%) over 351.5 mg');
  });

  it('says the measured amount once: in the rounding note when there is one, and a difference under 1% as such', () => {
    // Amoxicillin 80 mg/mL: 28.12 kg × 80 mg/kg/day ÷ 2 = 1124.8 mg = 14.06 mL, measured to 14 mL.
    const dose = plainDose({
      weightKg: 28.12,
      mgPerMeasure: 80,
      measure: 'mL',
      basis: 'mg/kg/day',
      rate: 80,
      dosesPerDay: 2,
    });
    expect(dose?.working).toBe('28.12 kg × 80 mg/kg/day ÷ 2 = 1124.8 mg');
    expect(dose?.roundingNote).toBe('14 mL = 1120 mg, 4.8 mg (under 1%) under 1124.8 mg');
  });

  it('measures a liquid to the step given: a tenth or a whole mL, with the rounding note at that step', () => {
    const input = {
      weightKg: 28.12,
      mgPerMeasure: 80,
      measure: 'mL' as const,
      basis: 'mg/kg/day' as const,
      rate: 25,
      dosesPerDay: 2,
    };
    expect(plainDose({ ...input, step: 0.1 })).toMatchObject({
      amount: 4.4,
      working: '28.12 kg × 25 mg/kg/day ÷ 2 = 351.5 mg',
      roundingNote: '4.4 mL = 352 mg, 0.5 mg (under 1%) over 351.5 mg',
    });
    expect(plainDose({ ...input, step: 1 })).toMatchObject({
      amount: 4,
      roundingNote: '4 mL = 320 mg, 31.5 mg (9%) under 351.5 mg',
    });
    expect(plainDose({ ...input, step: 0.5 })).toEqual(plainDose(input));
  });

  it('caps and measures down at a tenth of a mL', () => {
    expect(
      plainDose({
        weightKg: 28.12,
        mgPerMeasure: 80,
        measure: 'mL',
        step: 0.1,
        basis: 'mg/kg/dose',
        rate: 25,
        maxPerDoseMg: 500,
      })
    ).toEqual({
      amount: 6.2,
      amountText: '6.2 mL',
      working: '28.12 kg × 25 mg/kg/dose = 703 mg → capped at 500 mg per dose',
      roundingNote:
        '6.2 mL = 496 mg, 4 mg (1%) under 500 mg (rounded down to stay at or under the max 500 mg per dose)',
      capNote: 'Capped at the 500 mg maximum (703 mg by weight)',
    });
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
      working: '28.12 kg × 25 mg/kg/dose = 703 mg → capped at 500 mg per dose',
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
    expect(dose?.working).toBe('470 mg');
    expect(dose?.roundingNote).toBe(
      '1 tablet = 300 mg, 170 mg (36%) under 470 mg (rounded down to stay at or under the max 500 mg per dose)'
    );
    // Rounded down, but not capped: the dose worked out was under the maximum.
    expect(dose?.capNote).toBeUndefined();
  });

  it('leaves a dose under its maximum as it is, and waits for the doses a day a per-day maximum needs', () => {
    expect(
      plainDose({ weightKg: 10, mgPerMeasure: 80, measure: 'mL', basis: 'mg/kg/dose', rate: 25, maxPerDoseMg: 500 })
    ).toMatchObject({ amountText: '3 mL', working: '10 kg × 25 mg/kg/dose = 250 mg' });
    expect(
      plainDose({ weightKg: 10, mgPerMeasure: 80, measure: 'mL', basis: 'mg/kg/dose', rate: 25, maxPerDayMg: 1000 })
    ).toBeUndefined();
  });

  it('never blocks a maximum under one measurable amount: one unit, said to be above the maximum', () => {
    // Capped at 250 mg, but the smallest amount of a 500 mg tablet is the whole tablet.
    const capped = plainDose({ mgPerMeasure: 500, measure: 'tablet', basis: 'fixed', rate: 400, maxPerDoseMg: 250 });
    expect(capped?.amountText).toBe('1 tablet');
    expect(capped?.capNote).toBe('1 tablet = 500 mg, above the 250 mg maximum; the smallest measurable amount');
    // Under the maximum as worked out, but still one unit above it.
    const under = plainDose({ mgPerMeasure: 500, measure: 'tablet', basis: 'fixed', rate: 200, maxPerDoseMg: 250 });
    expect(under?.amountText).toBe('1 tablet');
    expect(under?.capNote).toBe('1 tablet = 500 mg, above the 250 mg maximum; the smallest measurable amount');
    // A per-day maximum says so.
    const perDay = plainDose({
      mgPerMeasure: 500,
      measure: 'tablet',
      basis: 'fixed',
      rate: 400,
      dosesPerDay: 2,
      maxPerDayMg: 500,
    });
    expect(perDay?.capNote).toBe(
      '1 tablet = 500 mg, above the 500 mg a day maximum (250 mg per dose); the smallest measurable amount'
    );
  });
});
