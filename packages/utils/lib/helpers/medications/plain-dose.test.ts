import { describe, expect, it } from 'vitest';
import { plainDose, startingMeasureStep } from './plain-dose';

describe('plainDose', () => {
  it('works out a per-dose rate, rounds to whole capsules and notes how far over it is', () => {
    expect(
      plainDose({ weightKg: 28.12, mgPerMeasure: 250, measure: 'capsule', basis: 'mg/kg/dose', rate: 25 })
    ).toEqual({
      amount: 3,
      amountText: '3 capsules',
      aimedAmount: 2.812,
      working: '28.12 kg × 25 mg/kg/dose = 703 mg',
      roundingNote: '3 capsules = 750 mg, 47 mg (7%) over 703 mg',
      roundingWarning: '3 capsules = 750 mg, 47 mg (7%) over 703 mg',
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

  it('says the measured amount once: in the rounding note when there is one, and a difference under 1% as less than 1%', () => {
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
    expect(dose?.roundingNote).toBe('14 mL = 1120 mg, 4.8 mg (less than 1%) under 1124.8 mg');
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
      roundingNote: '4.4 mL = 352 mg, 0.5 mg (less than 1%) over 351.5 mg',
    });
    expect(plainDose({ ...input, step: 1 })).toMatchObject({
      amount: 4,
      roundingNote: '4 mL = 320 mg, 31.5 mg (9%) under 351.5 mg',
    });
    expect(plainDose({ ...input, step: 0.5 })).toEqual(plainDose(input));
  });

  // Decision 305: a liquid dose under 1 mL starts at a tenth of a mL; at half a mL an infant's 0.19 mL would be 0.5 mL.
  it('starts a liquid at a tenth of a mL for a dose under 1 mL, after any cap, and at half a mL otherwise', () => {
    // Famotidine 8 mg/mL, 0.5 mg/kg for 3 kg: 1.5 mg = 0.19 mL, measured to 0.2 mL.
    const famotidine = {
      weightKg: 3,
      mgPerMeasure: 8,
      measure: 'mL' as const,
      basis: 'mg/kg/dose' as const,
      rate: 0.5,
    };
    expect(startingMeasureStep(famotidine)).toBe(0.1);
    expect(plainDose({ ...famotidine, step: startingMeasureStep(famotidine) })?.amountText).toBe('0.2 mL');
    // Amoxicillin 80 mg/mL, 25 mg/kg for 28.12 kg: 8.79 mL.
    const amoxicillin = {
      weightKg: 28.12,
      mgPerMeasure: 80,
      measure: 'mL' as const,
      basis: 'mg/kg/dose' as const,
      rate: 25,
    };
    expect(startingMeasureStep(amoxicillin)).toBe(0.5);
    // 8.79 mL capped at 40 mg = 0.5 mL: under 1 mL once capped.
    expect(startingMeasureStep({ ...amoxicillin, maxPerDoseMg: 40 })).toBe(0.1);
    // Exactly 1 mL, waiting for inputs, or a tablet: as before.
    expect(startingMeasureStep({ ...famotidine, rate: 8 / 3 })).toBe(0.5);
    expect(startingMeasureStep({ ...famotidine, rate: undefined })).toBe(0.5);
    expect(startingMeasureStep({ ...famotidine, measure: 'tablet' })).toBe(1);
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
      aimedAmount: 6.25,
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

  // Decisions 133 and 301: a measured dose more than 5% over or under the dose worked out is said under the result
  // too (the Pediatric Pharmacy Association rounds within 5% to 10% of the calculated weight-based dose).
  it('says under the result when the measured dose is more than 5% over or under the one worked out', () => {
    const capsule = { mgPerMeasure: 250, measure: 'capsule' as const, basis: 'fixed' as const };
    // 4% over: only the ⓘ.
    expect(plainDose({ ...capsule, rate: 240 })?.roundingNote).toBe('1 capsule = 250 mg, 10 mg (4%) over 240 mg');
    expect(plainDose({ ...capsule, rate: 240 })).not.toHaveProperty('roundingWarning');
    // 6% over and 6% under: under the result too.
    expect(plainDose({ ...capsule, rate: 236 })?.roundingWarning).toBe('1 capsule = 250 mg, 14 mg (6%) over 236 mg');
    expect(plainDose({ ...capsule, rate: 266 })?.roundingWarning).toBe('1 capsule = 250 mg, 16 mg (6%) under 266 mg');
    // Famotidine 40 mg/5 mL (8 mg/mL), 0.5 mg/kg for a 3 kg infant: 1.5 mg = 0.19 mL.
    const famotidine = {
      weightKg: 3,
      mgPerMeasure: 8,
      measure: 'mL' as const,
      basis: 'mg/kg/dose' as const,
      rate: 0.5,
    };
    expect(plainDose(famotidine)?.roundingWarning).toBe('0.5 mL = 4 mg, 2.5 mg (167%) over 1.5 mg');
    expect(plainDose({ ...famotidine, step: 0.1 })?.roundingWarning).toBe('0.2 mL = 1.6 mg, 0.1 mg (7%) over 1.5 mg');
    // A capped dose shows only its cap line: 703 mg capped at 400 mg, measured down to 1 capsule = 250 mg.
    const capped = plainDose({
      weightKg: 28.12,
      mgPerMeasure: 250,
      measure: 'capsule',
      basis: 'mg/kg/dose',
      rate: 25,
      maxPerDoseMg: 400,
    });
    expect(capped?.capNote).toBe('Capped at the 400 mg maximum (703 mg by weight)');
    expect(capped).not.toHaveProperty('roundingWarning');
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
      aimedAmount: 6.25,
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

  it('leaves a dose under its maximum as it is, and checks a per-day maximum only with the doses a day', () => {
    expect(
      plainDose({ weightKg: 10, mgPerMeasure: 80, measure: 'mL', basis: 'mg/kg/dose', rate: 25, maxPerDoseMg: 500 })
    ).toMatchObject({ amountText: '3 mL', working: '10 kg × 25 mg/kg/dose = 250 mg' });
    expect(
      plainDose({ weightKg: 10, mgPerMeasure: 80, measure: 'mL', basis: 'mg/kg/dose', rate: 40, maxPerDayMg: 100 })
    ).toMatchObject({ amountText: '5 mL', working: '10 kg × 40 mg/kg/dose = 400 mg → 5 mL = 400 mg' });
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

  // Review D2-3: an every-other-day rate per day is the dosing day's amount, as alternate-day steroids are written
  // (KDIGO 2025, 1.5 mg/kg "on alternate days"): never divided by 0.5, and the per-day maximum caps that day's dose.
  it('takes a per-day rate and maximum as the dosing day’s, under one dose a day', () => {
    // Prednisolone 15 mg/5 mL (3 mg/mL), 20 kg, 2 mg/kg/day every other day.
    const eod = {
      weightKg: 20,
      mgPerMeasure: 3,
      measure: 'mL' as const,
      basis: 'mg/kg/day' as const,
      dosesPerDay: 0.5,
    };
    expect(plainDose({ ...eod, rate: 2 })).toMatchObject({
      amount: 13.5,
      working: '20 kg × 2 mg/kg/day ÷ 1 = 40 mg',
    });
    const capped = plainDose({ ...eod, rate: 4, maxPerDayMg: 60 });
    expect(capped?.amount).toBe(20);
    expect(capped?.capNote).toBe('Capped at the 60 mg a day maximum (80 mg a day by weight)');
  });
});
