import { describe, expect, it } from 'vitest';
import {
  frequencyForDosesPerDay,
  parseStrengthConcentration,
  PRESCRIPTION_FREQUENCIES,
  prescriptionDirectionsText,
  prescriptionDispense,
  prescriptionDoseForm,
  prescriptionDoseUnit,
  prescriptionQuantityUnit,
  prescriptionRoute,
} from './prescription-suggestions';

describe('prescriptionDoseForm', () => {
  it.each([
    ['Amoxicillin 500 MG Oral Capsule', 'capsule'],
    ['Azithromycin 250 MG Oral Tablet', 'tablet'],
    ['Ondansetron 4 MG Disintegrating Oral Tablet (ODT)', 'tablet'],
    ['Amoxicillin 400 MG/5ML Oral Suspension', 'liquid'],
    ['Albuterol 90 MCG/ACTUAT Metered Dose Inhaler', 'inhaler'],
    ['Mupirocin 2 % Topical Ointment', 'topical'],
    ['Nicotine 21 MG/24HR Transdermal Patch', 'patch'],
    ['Promethazine 25 MG Rectal Suppository', 'suppository'],
    // RxTerms abbreviations, as the terminology search returns them.
    ['Amoxicillin 250 mg Cap', 'capsule'],
    ['Amoxicillin 875 mg Tab', 'tablet'],
    ['Amoxicillin 250 mg/5ml Susp', 'liquid'],
    ['Albuterol 90 mcg/puff MDI', 'inhaler'],
    ['Ofloxacin (Otic) 0.3% Sol', 'liquid'],
    ['Lidocaine 5 % Topical Spray', undefined],
  ])('%s → %s', (description, form) => {
    expect(prescriptionDoseForm(description)).toBe(form);
  });
});

describe('prescriptionQuantityUnit', () => {
  it.each([
    ['Amoxicillin 875 mg Tab', 'Tablet'],
    ['Ondansetron 4 MG Disintegrating Oral Tablet (ODT)', 'Tablet'],
    ['Cephalexin 500 mg Cap', 'Capsule'],
    ['Prednisolone 15 mg/5ml Sol', 'Milliliter'],
    ['Albuterol 90 MCG/ACTUAT Metered Dose Inhaler', 'Inhaler'],
    ['Mupirocin 2% Ointment', 'Gram'],
    ['Nicotine 21 MG/24HR Transdermal Patch', 'Patch'],
    ['Promethazine 25 MG Rectal Suppository', 'Suppository'],
    ['Lidocaine 5 % Topical Spray', undefined],
  ])('%s → %s', (description, unit) => {
    expect(prescriptionQuantityUnit(description)).toBe(unit);
  });
});

describe('prescriptionRoute', () => {
  it.each([
    ['Amoxicillin 500 MG Oral Capsule', 'by mouth'],
    ['Ondansetron 4 MG Disintegrating Oral Tablet (ODT)', 'by mouth'],
    ['Amoxicillin 250 mg/5ml Susp', 'by mouth'],
    ['Albuterol 90 MCG/ACTUAT Metered Dose Inhaler', 'inhaled'],
    ['Ofloxacin (Otic) 0.3% Sol', 'in the ear'],
    ['Prednisolone 1 % Ophthalmic Suspension', 'in the eye'],
    ['Prednisolone/Sulfacetamide (Ophthalmic) 0.2-10% Ointment', 'in the eye'],
    ['Fluticasone 50 MCG/ACTUAT Nasal Spray', 'in the nose'],
    ['Mupirocin 2 % Topical Ointment', 'on the skin'],
    ['Nicotine 21 MG/24HR Transdermal Patch', 'on the skin'],
    ['Promethazine 25 MG Rectal Suppository', 'rectally'],
    ['Ondansetron (Injectable) 2 mg/ml Sol', 'by injection'],
    ['Epinephrine 0.3 MG Auto-Injector', undefined],
  ])('%s → %s', (description, route) => {
    expect(prescriptionRoute(description)).toBe(route);
  });
});

describe('PRESCRIPTION_FREQUENCIES', () => {
  it('lists the scheduled frequencies before the as-needed ones, each with its doses a day', () => {
    expect(Object.keys(PRESCRIPTION_FREQUENCIES)).toEqual([
      'once daily',
      'twice daily',
      'three times daily',
      'four times daily',
      'every 4 hours',
      'every 4 to 6 hours',
      'every 6 to 8 hours',
      'every 6 hours',
      'every 8 hours',
      'every 12 hours',
      'every other day',
      'at bedtime',
      'every 4 hours as needed',
      'every 4 to 6 hours as needed',
      'every 6 to 8 hours as needed',
      'every 6 hours as needed',
      'every 8 hours as needed',
      'as needed',
      'as directed',
      'per package instructions',
    ]);
    expect(PRESCRIPTION_FREQUENCIES['every other day']).toEqual({ dosesPerDay: 0.5, asNeeded: false });
    expect(PRESCRIPTION_FREQUENCIES['every 4 hours as needed']).toEqual({ dosesPerDay: 6, asNeeded: true });
    expect(PRESCRIPTION_FREQUENCIES['every 4 hours']).toEqual({ dosesPerDay: 6, asNeeded: false });
    // A range counts its most frequent for the quantity.
    expect(PRESCRIPTION_FREQUENCIES['every 4 to 6 hours']).toEqual({ dosesPerDay: 6, asNeeded: false });
    expect(PRESCRIPTION_FREQUENCIES['every 6 to 8 hours']).toEqual({ dosesPerDay: 4, asNeeded: false });
    expect(PRESCRIPTION_FREQUENCIES['every 6 hours']).toEqual({ dosesPerDay: 4, asNeeded: false });
    expect(PRESCRIPTION_FREQUENCIES['every 8 hours']).toEqual({ dosesPerDay: 3, asNeeded: false });
    expect(PRESCRIPTION_FREQUENCIES['every 12 hours']).toEqual({ dosesPerDay: 2, asNeeded: false });
    expect(PRESCRIPTION_FREQUENCIES['every 4 to 6 hours as needed']).toEqual({ dosesPerDay: 6, asNeeded: true });
    expect(PRESCRIPTION_FREQUENCIES['as needed']).toEqual({ asNeeded: true });
    expect(PRESCRIPTION_FREQUENCIES['as directed']).toEqual({ asNeeded: false, directed: true });
  });

  it('writes "every 6 to 8 hours" as the provider words it and counts the quantity at every 6 hours', () => {
    const directions = { dose: '5', route: 'by mouth' as const, frequency: 'every 6 to 8 hours', durationDays: '5' };
    expect(prescriptionDirectionsText('Ibuprofen 100 mg/5ml Susp', directions)).toBe(
      'Take 5 mL by mouth every 6 to 8 hours for 5 days.'
    );
    // 5 mL × 4 a day × 5 days.
    expect(prescriptionDispense('Ibuprofen 100 mg/5ml Susp', directions)).toEqual({
      quantityValue: '100',
      daysSupply: '5',
    });
    // Four a day is still written "four times daily" when the calculator names a frequency.
    expect(frequencyForDosesPerDay(4)).toBe('four times daily');
  });
});

/** Azithromycin's two steps: 2 tablets on day 1, then 1 a day for 4 days. */
const AZITHROMYCIN = {
  dose: '2',
  route: 'by mouth' as const,
  frequency: 'once daily',
  durationDays: '1',
  steps: [{ dose: '1', frequency: 'once daily', durationDays: '4' }],
};

/** A prednisone taper in 10 mg tablets: 40, 30, 20 and 10 mg, two days each. */
const PREDNISONE = {
  dose: '4',
  route: 'by mouth' as const,
  frequency: 'once daily',
  durationDays: '2',
  steps: ['3', '2', '1'].map((dose) => ({ dose, frequency: 'once daily', durationDays: '2' })),
};

describe('multi-step directions', () => {
  it('reads each later step as "then", with the route, and adds up the quantity and days', () => {
    expect(prescriptionDirectionsText('Azithromycin 250 mg Tab', AZITHROMYCIN)).toBe(
      'Take 2 tablets by mouth once daily for 1 day, then 1 tablet by mouth once daily for 4 days.'
    );
    expect(prescriptionDispense('Azithromycin 250 mg Tab', AZITHROMYCIN)).toEqual({
      quantityValue: '6',
      daysSupply: '5',
    });
  });

  it('runs a taper of any length', () => {
    expect(prescriptionDirectionsText('Prednisone 10 mg Tab', PREDNISONE)).toBe(
      'Take 4 tablets by mouth once daily for 2 days, then 3 tablets by mouth once daily for 2 days, ' +
        'then 2 tablets by mouth once daily for 2 days, then 1 tablet by mouth once daily for 2 days.'
    );
    expect(prescriptionDispense('Prednisone 10 mg Tab', PREDNISONE)).toEqual({ quantityValue: '20', daysSupply: '8' });
  });

  it('measures a liquid’s steps in mL and rounds the total up once', () => {
    const fluconazole = {
      dose: '10',
      route: 'by mouth' as const,
      frequency: 'once daily',
      durationDays: '1',
      steps: [{ dose: '5', frequency: 'once daily', durationDays: '4' }],
    };
    expect(prescriptionDirectionsText('Fluconazole 40 mg/ml Susp', fluconazole)).toBe(
      'Take 10 mL by mouth once daily for 1 day, then 5 mL by mouth once daily for 4 days.'
    );
    expect(prescriptionDispense('Fluconazole 40 mg/ml Susp', fluconazole)).toEqual({
      quantityValue: '30',
      daysSupply: '5',
    });
    const halves = {
      ...fluconazole,
      dose: '0.5',
      steps: [{ ...fluconazole.steps[0], dose: '0.5', durationDays: '1' }],
    };
    expect(prescriptionDispense('Fluconazole 40 mg/ml Susp', halves).quantityValue).toBe('1');
  });

  it('ignores a step with nothing picked, and can’t count until a step is complete', () => {
    const empty = { ...AZITHROMYCIN, steps: [{ dose: '', frequency: '', durationDays: '' }] };
    expect(prescriptionDirectionsText('Azithromycin 250 mg Tab', empty)).toBe(
      'Take 2 tablets by mouth once daily for 1 day.'
    );
    expect(prescriptionDispense('Azithromycin 250 mg Tab', empty)).toEqual({ quantityValue: '2', daysSupply: '1' });
    const partial = { ...AZITHROMYCIN, steps: [{ dose: '1', frequency: '', durationDays: '' }] };
    expect(prescriptionDirectionsText('Azithromycin 250 mg Tab', partial)).toBe(
      'Take 2 tablets by mouth once daily for 1 day, then 1 tablet by mouth.'
    );
    expect(prescriptionDispense('Azithromycin 250 mg Tab', partial)).toEqual({ quantityValue: '', daysSupply: '' });
  });

  it('dispenses one inhaler for the whole course', () => {
    const inhaler = { ...AZITHROMYCIN, route: 'inhaled' as const };
    expect(prescriptionDispense('Albuterol 90 mcg/puff MDI', inhaler)).toEqual({ quantityValue: '1', daysSupply: '5' });
  });
});

describe('directions without a dose', () => {
  it('reads the verb and the instructions for a device, leaving the quantity to the provider', () => {
    const spacer = {
      dose: '',
      route: 'inhaled' as const,
      frequency: '',
      durationDays: '',
      instructions: 'with albuterol inhaler',
    };
    expect(prescriptionDirectionsText('Spacer Device', spacer)).toBe('Inhale with albuterol inhaler.');
    expect(prescriptionDispense('Spacer Device', spacer)).toEqual({ quantityValue: '', daysSupply: '' });
  });

  it('reads "as directed" with the route and the dose when given, with the duration if given, and counts nothing', () => {
    const directed = { dose: '', route: 'by mouth' as const, frequency: 'as directed', durationDays: '' };
    expect(prescriptionDirectionsText('Methylprednisolone 4 mg Tab', directed)).toBe('Take by mouth as directed.');
    expect(prescriptionDirectionsText('Methylprednisolone 4 mg Tab', { ...directed, durationDays: '6' })).toBe(
      'Take by mouth as directed for 6 days.'
    );
    expect(prescriptionDirectionsText('Ibuprofen 100 mg/5ml Susp', { ...directed, dose: '14' })).toBe(
      'Take 14 mL by mouth as directed.'
    );
    expect(prescriptionDirectionsText('Spacer Device', { ...directed, route: '' })).toBe('Take as directed.');
    expect(prescriptionDispense('Methylprednisolone 4 mg Tab', { ...directed, durationDays: '6' })).toEqual({
      quantityValue: '',
      daysSupply: '6',
    });
  });

  it('dispenses one package "per package instructions"', () => {
    const pack = { dose: '', route: 'by mouth' as const, frequency: 'per package instructions', durationDays: '6' };
    expect(prescriptionDirectionsText('Methylprednisolone 4 mg Tab', pack)).toBe(
      'Take by mouth per package instructions for 6 days.'
    );
    expect(prescriptionDispense('Methylprednisolone 4 mg Tab', pack)).toEqual({ quantityValue: '1', daysSupply: '6' });
  });
});

describe('directions with instructions', () => {
  it('ends the sentence with them, after the last step, without doubling the full stop', () => {
    expect(
      prescriptionDirectionsText('Albuterol 90 mcg/puff MDI', {
        dose: '2',
        route: 'inhaled',
        frequency: 'every 4 hours as needed',
        durationDays: '7',
        instructions: 'with spacer.',
      })
    ).toBe('Inhale 2 puffs every 4 hours as needed for up to 7 days, with spacer.');
    expect(prescriptionDirectionsText('Azithromycin 250 mg Tab', { ...AZITHROMYCIN, instructions: 'with food' })).toBe(
      'Take 2 tablets by mouth once daily for 1 day, then 1 tablet by mouth once daily for 4 days, with food.'
    );
    expect(
      prescriptionDirectionsText('Permethrin 1% Lotion', {
        dose: '',
        route: 'on the skin',
        frequency: 'once daily',
        durationDays: '1',
        instructions: 'leave in 10 minutes then rinse; repeat in 7 days if needed',
      })
    ).toBe('Apply on the skin once daily for 1 day, leave in 10 minutes then rinse; repeat in 7 days if needed.');
  });
});

describe('prescriptionDirectionsText', () => {
  it('reads the dose in the form’s unit, then the route, frequency and duration', () => {
    expect(
      prescriptionDirectionsText('Amoxicillin 250 mg/5ml Susp', {
        dose: '5',
        route: 'by mouth',
        frequency: 'twice daily',
        durationDays: '10',
      })
    ).toBe('Take 5 mL by mouth twice daily for 10 days.');
    expect(
      prescriptionDirectionsText('Amoxicillin 875 mg Tab', {
        dose: '1',
        route: 'by mouth',
        frequency: 'at bedtime',
        durationDays: '1',
      })
    ).toBe('Take 1 tablet by mouth at bedtime for 1 day.');
  });

  it('lets the verb say the route for an inhaler, and reads an as-needed duration as "up to"', () => {
    expect(
      prescriptionDirectionsText('Albuterol 90 mcg/puff MDI', {
        dose: '2',
        route: 'inhaled',
        frequency: 'every 4 hours as needed',
        durationDays: '5',
      })
    ).toBe('Inhale 2 puffs every 4 hours as needed for up to 5 days.');
  });

  it('counts ear drops in drops and leaves out what is not picked', () => {
    expect(
      prescriptionDirectionsText('Ofloxacin (Otic) 0.3% Sol', {
        dose: '5',
        route: 'in the ear',
        frequency: '',
        durationDays: '',
      })
    ).toBe('Put 5 drops in the ear.');
    expect(
      prescriptionDirectionsText('Mupirocin 2% Ointment', {
        dose: '',
        route: 'on the skin',
        frequency: 'three times daily',
        durationDays: '7',
      })
    ).toBe('Apply on the skin three times daily for 7 days.');
  });

  it('says nothing until a dose or frequency is picked', () => {
    expect(
      prescriptionDirectionsText('Amoxicillin 875 mg Tab', {
        dose: '',
        route: 'by mouth',
        frequency: '',
        durationDays: '',
      })
    ).toBe('');
  });
});

describe('prescriptionDispense', () => {
  it('multiplies the dose by the doses a day and the days, rounding up, with the duration as days supply', () => {
    expect(
      prescriptionDispense('Amoxicillin 250 mg/5ml Susp', {
        dose: '7.5',
        route: 'by mouth',
        frequency: 'twice daily',
        durationDays: '10',
      })
    ).toEqual({ quantityValue: '150', daysSupply: '10' });
    expect(
      prescriptionDispense('Amoxicillin 875 mg Tab', {
        dose: '1',
        route: 'by mouth',
        frequency: 'every other day',
        durationDays: '7',
      })
    ).toEqual({ quantityValue: '4', daysSupply: '7' });
  });

  it('counts an as-needed frequency at its most frequent, and none at all for a bare "as needed"', () => {
    const directions = {
      dose: '1',
      route: 'by mouth' as const,
      frequency: 'every 6 hours as needed',
      durationDays: '5',
    };
    expect(prescriptionDispense('Ibuprofen 400 mg Tab', directions)).toEqual({ quantityValue: '20', daysSupply: '5' });
    expect(prescriptionDispense('Ibuprofen 400 mg Tab', { ...directions, frequency: 'as needed' })).toEqual({
      quantityValue: '',
      daysSupply: '5',
    });
  });

  it('dispenses one inhaler whatever the doses', () => {
    expect(
      prescriptionDispense('Albuterol 90 mcg/puff MDI', {
        dose: '2',
        route: 'inhaled',
        frequency: 'every 4 hours as needed',
        durationDays: '30',
      })
    ).toEqual({ quantityValue: '1', daysSupply: '30' });
  });

  it('leaves the quantity of a cream or of drops to the provider', () => {
    expect(
      prescriptionDispense('Mupirocin 2% Ointment', {
        dose: '1',
        route: 'on the skin',
        frequency: 'three times daily',
        durationDays: '7',
      })
    ).toEqual({ quantityValue: '', daysSupply: '7' });
    expect(
      prescriptionDispense('Ofloxacin (Otic) 0.3% Sol', {
        dose: '5',
        route: 'in the ear',
        frequency: 'twice daily',
        durationDays: '7',
      })
    ).toEqual({ quantityValue: '', daysSupply: '7' });
  });
});

describe('parseStrengthConcentration', () => {
  it.each([
    ['400 MG/5ML', { mgPerMl: 80 }],
    ['Amoxicillin 400 MG/5ML Oral Suspension', { mgPerMl: 80 }],
    ['80 MG/ML', { mgPerMl: 80 }],
    ['400 mg/5ml Susp', { mgPerMl: 80 }],
    ['15 mg/5ml Sol', { mgPerMl: 3 }],
    ['100 mg/5ml Susp', { mgPerMl: 20 }],
    // A combination's first ingredient.
    ['400-57 mg/5ml Susp', { mgPerMl: 80 }],
    ['amoxicillin 80 MG/ML / clavulanate 11.4 MG/ML Oral Suspension', { mgPerMl: 80 }],
    ['250 mg Cap', { mgPerUnit: 250 }],
    ['1 GM Tab', { mgPerUnit: 1000 }],
    ['4 mg ODT Tab', { mgPerUnit: 4 }],
    ['Azithromycin 250 MG Oral Tablet', { mgPerUnit: 250 }],
    ['90 mcg/puff HFA MDI', { mgPerUnit: 0.09 }],
    ['1 g Tab', { mgPerUnit: 1000 }],
    // A salt with its base: dosed on the base (pyrantel pamoate 144 mg = 50 mg pyrantel base).
    ['Pinworm Medicine Oral Suspension 144 (50 Base) MG/ML', { mgPerMl: 50 }],
    ['108 (90 Base) MCG/ACT', { mgPerUnit: 0.09 }],
  ])('%s → %j', (text, expected) => {
    expect(parseStrengthConcentration(text)).toEqual(expected);
  });

  it.each(['2% Ointment', '0.3% Sol', 'Insulin 100 UNT/ML', 'Albuterol'])('%s → nothing', (text) => {
    expect(parseStrengthConcentration(text)).toBeUndefined();
  });
});

describe('prescriptionDoseUnit', () => {
  it('counts a nasal spray in sprays, nasal drops in drops, and a spray in sprays in the directions', () => {
    expect(prescriptionDoseUnit('liquid', 'in the nose', 'Fluticasone 50 MCG/ACTUAT Nasal Suspension')).toBe('spray');
    expect(prescriptionDoseUnit(undefined, 'in the nose', 'Saline 0.65 % Nasal Spray')).toBe('spray');
    expect(prescriptionDoseUnit('liquid', 'in the nose', 'Phenylephrine 0.125 % Nasal Solution')).toBe('drop');
    expect(
      prescriptionDirectionsText('Fluticasone Propionate 50 MCG/ACTUAT Nasal Spray', {
        dose: '2',
        route: 'in the nose',
        frequency: 'once daily',
        durationDays: '',
      })
    ).toBe('Put 2 sprays in the nose once daily.');
  });
});
