import { describe, expect, it } from 'vitest';
import { MedicationIngredient } from '../../types/api/erx-search.types';
import {
  isCombinationProduct,
  PRESCRIPTION_FREQUENCIES,
  prescriptionDirectionsText,
  prescriptionDispense,
  prescriptionDoseForm,
  prescriptionDoseUnit,
  prescriptionFrequency,
  PrescriptionProduct,
  prescriptionQuantityUnit,
  prescriptionRoute,
} from './prescription-suggestions';

/** Products as the medication search details them: RxNorm's dose form and ingredients. */
const ingredient = (name: string, amount: number, perUnit: string): MedicationIngredient => ({
  name,
  amount,
  unit: 'MG',
  per: 1,
  perUnit,
});
const liquid = (doseForm: string, name: string, mgPerMl: number): PrescriptionProduct => ({
  doseForm,
  ingredients: [ingredient(name, mgPerMl, 'ML')],
});
const each = (doseForm: string, name: string, mg: number): PrescriptionProduct => ({
  doseForm,
  ingredients: [ingredient(name, mg, 'EACH')],
});
/** A device: no dose form, no ingredients. */
const SPACER: PrescriptionProduct = {};
const IBUPROFEN_SUSP = liquid('Oral Suspension', 'ibuprofen', 20);
const AMOXICILLIN_400_SUSP = liquid('Oral Suspension', 'amoxicillin', 80);
const AMOXICILLIN_250_SUSP = liquid('Oral Suspension', 'amoxicillin', 50);
const FLUCONAZOLE_SUSP = liquid('Powder for Oral Suspension', 'fluconazole', 40);
const AZITHROMYCIN_TAB = each('Oral Tablet', 'azithromycin', 250);
const PREDNISONE_TAB = each('Oral Tablet', 'prednisone', 10);
const METHYLPREDNISOLONE_TAB = each('Oral Tablet', 'methylprednisolone', 4);
const AMOXICILLIN_875_TAB = each('Oral Tablet', 'amoxicillin', 875);
const IBUPROFEN_TAB = each('Oral Tablet', 'ibuprofen', 400);
const ALBUTEROL_MDI = { doseForm: 'Metered Dose Inhaler', ingredients: [ingredient('albuterol', 0.09, 'ACTUAT')] };
const OFLOXACIN_OTIC = liquid('Otic Solution', 'ofloxacin', 3);
const MUPIROCIN_OINTMENT = { doseForm: 'Topical Ointment', ingredients: [ingredient('mupirocin', 0.02, 'MG')] };

describe('the RxNorm dose form table', () => {
  it.each([
    ['Oral Capsule', 'capsule', 'by mouth', 'capsule', 'Capsule'],
    ['Oral Tablet', 'tablet', 'by mouth', 'tablet', 'Tablet'],
    ['Disintegrating Oral Tablet', 'tablet', 'by mouth', 'tablet', 'Tablet'],
    ['Chewable Tablet', 'tablet', 'by mouth', 'tablet', 'Tablet'],
    ['Oral Suspension', 'liquid', 'by mouth', 'mL', 'Milliliter'],
    ['Oral Solution', 'liquid', 'by mouth', 'mL', 'Milliliter'],
    ['Metered Dose Inhaler', 'inhaler', 'inhaled', 'puff', 'Inhaler'],
    ['Inhalation Spray', 'inhaler', 'inhaled', 'puff', 'Inhaler'],
    ['Inhalation Solution', 'liquid', 'inhaled', 'mL', 'Milliliter'],
    ['Nasal Spray', undefined, 'in the nose', 'spray', undefined],
    ['Metered Dose Nasal Spray', undefined, 'in the nose', 'spray', undefined],
    ['Nasal Solution', 'liquid', 'in the nose', 'drop', 'Milliliter'],
    ['Ophthalmic Solution', 'liquid', 'in the eye', 'drop', 'Milliliter'],
    ['Ophthalmic Ointment', 'topical', 'in the eye', undefined, 'Gram'],
    ['Otic Solution', 'liquid', 'in the ear', 'drop', 'Milliliter'],
    ['Topical Cream', 'topical', 'on the skin', undefined, 'Gram'],
    ['Topical Ointment', 'topical', 'on the skin', undefined, 'Gram'],
    ['Topical Spray', undefined, 'on the skin', undefined, undefined],
    ['Transdermal System', 'patch', 'on the skin', 'patch', 'Patch'],
    ['Rectal Suppository', 'suppository', 'rectally', 'suppository', 'Suppository'],
    ['Injectable Solution', 'liquid', 'by injection', 'mL', 'Milliliter'],
    ['Auto-Injector', undefined, 'by injection', undefined, undefined],
    // A pack says nothing of how it is taken; a form not in the table, or a near spelling, implies nothing.
    ['Pack', undefined, undefined, undefined, undefined],
    ['Oral Lozenge', undefined, undefined, undefined, undefined],
    ['oral tablet', undefined, undefined, undefined, undefined],
    ['constructor', undefined, undefined, undefined, undefined],
  ])('%s → %s, %s, %s, %s', (doseForm, form, route, unit, quantityUnit) => {
    expect(prescriptionDoseForm({ doseForm })).toBe(form);
    expect(prescriptionRoute({ doseForm })).toBe(route);
    expect(prescriptionDoseUnit({ doseForm })).toBe(unit);
    expect(prescriptionQuantityUnit({ doseForm })).toBe(quantityUnit);
  });

  it('implies nothing for a product without details', () => {
    expect(prescriptionDoseForm({})).toBeUndefined();
    expect(prescriptionRoute(undefined)).toBeUndefined();
    expect(prescriptionDoseUnit(null)).toBeUndefined();
  });

  it('counts a nasal spray in sprays and nasal drops in drops', () => {
    expect(
      prescriptionDirectionsText(
        { doseForm: 'Metered Dose Nasal Spray', ingredients: [ingredient('fluticasone', 0.05, 'ACTUAT')] },
        { dose: '2', route: 'in the nose', frequency: 'once daily', durationDays: '' }
      )
    ).toBe('Put 2 sprays in the nose once daily.');
    expect(
      prescriptionDirectionsText(liquid('Nasal Solution', 'phenylephrine', 1.25), {
        dose: '2',
        route: 'in the nose',
        frequency: 'once daily',
        durationDays: '',
      })
    ).toBe('Put 2 drops in the nose once daily.');
  });
});

describe('isCombinationProduct', () => {
  it('is more than one ingredient', () => {
    expect(
      isCombinationProduct({
        doseForm: 'Oral Suspension',
        ingredients: [ingredient('amoxicillin', 80, 'ML'), ingredient('clavulanate', 11.4, 'ML')],
      })
    ).toBe(true);
    expect(isCombinationProduct(AMOXICILLIN_400_SUSP)).toBe(false);
    expect(isCombinationProduct({})).toBe(false);
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
    expect(PRESCRIPTION_FREQUENCIES['as directed']).toEqual({ asNeeded: false });
  });

  it('writes "every 6 to 8 hours" as the provider words it and counts the quantity at every 6 hours', () => {
    const directions = { dose: '5', route: 'by mouth' as const, frequency: 'every 6 to 8 hours', durationDays: '5' };
    expect(prescriptionDirectionsText(IBUPROFEN_SUSP, directions)).toBe(
      'Take 5 mL by mouth every 6 to 8 hours for 5 days.'
    );
    // 5 mL × 4 a day × 5 days.
    expect(prescriptionDispense(IBUPROFEN_SUSP, directions)).toEqual({
      quantityValue: '100',
      daysSupply: '5',
    });
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

describe('prescriptionFrequency', () => {
  it('looks a frequency up by its own key only, never one every object has', () => {
    expect(prescriptionFrequency('twice daily')).toEqual({ dosesPerDay: 2, asNeeded: false });
    expect(prescriptionFrequency('constructor')).toBeUndefined();
    expect(prescriptionFrequency('toString')).toBeUndefined();
    expect(prescriptionFrequency('__proto__')).toBeUndefined();
    const directions = { dose: '5', route: 'by mouth' as const, frequency: 'constructor', durationDays: '10' };
    expect(prescriptionDirectionsText(AMOXICILLIN_400_SUSP, directions)).toBe('Take 5 mL by mouth for 10 days.');
  });
});

describe('multi-step directions', () => {
  it('reads each later step as "then", with the route, and adds up the quantity and days', () => {
    expect(prescriptionDirectionsText(AZITHROMYCIN_TAB, AZITHROMYCIN)).toBe(
      'Take 2 tablets by mouth once daily for 1 day, then 1 tablet by mouth once daily for 4 days.'
    );
    expect(prescriptionDispense(AZITHROMYCIN_TAB, AZITHROMYCIN)).toEqual({
      quantityValue: '6',
      daysSupply: '5',
    });
  });

  it('runs a taper of any length', () => {
    expect(prescriptionDirectionsText(PREDNISONE_TAB, PREDNISONE)).toBe(
      'Take 4 tablets by mouth once daily for 2 days, then 3 tablets by mouth once daily for 2 days, ' +
        'then 2 tablets by mouth once daily for 2 days, then 1 tablet by mouth once daily for 2 days.'
    );
    expect(prescriptionDispense(PREDNISONE_TAB, PREDNISONE)).toEqual({ quantityValue: '20', daysSupply: '8' });
  });

  it('measures a liquid’s steps in mL and rounds the total up once', () => {
    const fluconazole = {
      dose: '10',
      route: 'by mouth' as const,
      frequency: 'once daily',
      durationDays: '1',
      steps: [{ dose: '5', frequency: 'once daily', durationDays: '4' }],
    };
    expect(prescriptionDirectionsText(FLUCONAZOLE_SUSP, fluconazole)).toBe(
      'Take 10 mL by mouth once daily for 1 day, then 5 mL by mouth once daily for 4 days.'
    );
    expect(prescriptionDispense(FLUCONAZOLE_SUSP, fluconazole)).toEqual({
      quantityValue: '30',
      daysSupply: '5',
    });
    const halves = {
      ...fluconazole,
      dose: '0.5',
      steps: [{ ...fluconazole.steps[0], dose: '0.5', durationDays: '1' }],
    };
    expect(prescriptionDispense(FLUCONAZOLE_SUSP, halves).quantityValue).toBe('1');
  });

  it('ignores a step with nothing picked, and can’t count until a step is complete', () => {
    const empty = { ...AZITHROMYCIN, steps: [{ dose: '', frequency: '', durationDays: '' }] };
    expect(prescriptionDirectionsText(AZITHROMYCIN_TAB, empty)).toBe('Take 2 tablets by mouth once daily for 1 day.');
    expect(prescriptionDispense(AZITHROMYCIN_TAB, empty)).toEqual({ quantityValue: '2', daysSupply: '1' });
    const partial = { ...AZITHROMYCIN, steps: [{ dose: '1', frequency: '', durationDays: '' }] };
    expect(prescriptionDirectionsText(AZITHROMYCIN_TAB, partial)).toBe(
      'Take 2 tablets by mouth once daily for 1 day, then 1 tablet by mouth.'
    );
    expect(prescriptionDispense(AZITHROMYCIN_TAB, partial)).toEqual({ quantityValue: '', daysSupply: '' });
  });

  it('reads the later steps when the first is empty, so a taper is not lost', () => {
    const laterOnly = {
      dose: '',
      route: 'by mouth' as const,
      frequency: '',
      durationDays: '',
      steps: [
        { dose: '2', frequency: 'once daily', durationDays: '2' },
        { dose: '', frequency: '', durationDays: '' },
        { dose: '1', frequency: 'once daily', durationDays: '2' },
      ],
    };
    expect(prescriptionDirectionsText(PREDNISONE_TAB, laterOnly)).toBe(
      'Take 2 tablets by mouth once daily for 2 days, then 1 tablet by mouth once daily for 2 days.'
    );
    expect(prescriptionDirectionsText(PREDNISONE_TAB, { ...laterOnly, instructions: 'with food' })).toBe(
      'Take 2 tablets by mouth once daily for 2 days, then 1 tablet by mouth once daily for 2 days, with food.'
    );
  });

  it('dispenses one inhaler for the whole course', () => {
    const inhaler = { ...AZITHROMYCIN, route: 'inhaled' as const };
    expect(prescriptionDispense(ALBUTEROL_MDI, inhaler)).toEqual({ quantityValue: '1', daysSupply: '5' });
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
    expect(prescriptionDirectionsText(SPACER, spacer)).toBe('Inhale with albuterol inhaler.');
    expect(prescriptionDispense(SPACER, spacer)).toEqual({ quantityValue: '', daysSupply: '' });
  });

  it('reads "as directed" with the route and the dose when given, with the duration if given, and counts nothing', () => {
    const directed = { dose: '', route: 'by mouth' as const, frequency: 'as directed', durationDays: '' };
    expect(prescriptionDirectionsText(METHYLPREDNISOLONE_TAB, directed)).toBe('Take by mouth as directed.');
    expect(prescriptionDirectionsText(METHYLPREDNISOLONE_TAB, { ...directed, durationDays: '6' })).toBe(
      'Take by mouth as directed for 6 days.'
    );
    expect(prescriptionDirectionsText(IBUPROFEN_SUSP, { ...directed, dose: '14' })).toBe(
      'Take 14 mL by mouth as directed.'
    );
    expect(prescriptionDirectionsText(SPACER, { ...directed, route: '' })).toBe('Take as directed.');
    expect(prescriptionDispense(METHYLPREDNISOLONE_TAB, { ...directed, durationDays: '6' })).toEqual({
      quantityValue: '',
      daysSupply: '6',
    });
  });

  it('dispenses one package "per package instructions"', () => {
    const pack = { dose: '', route: 'by mouth' as const, frequency: 'per package instructions', durationDays: '6' };
    expect(prescriptionDirectionsText(METHYLPREDNISOLONE_TAB, pack)).toBe(
      'Take by mouth per package instructions for 6 days.'
    );
    expect(prescriptionDispense(METHYLPREDNISOLONE_TAB, pack)).toEqual({ quantityValue: '1', daysSupply: '6' });
  });
});

describe('directions with instructions', () => {
  it('ends the sentence with them, after the last step, without doubling the full stop', () => {
    expect(
      prescriptionDirectionsText(ALBUTEROL_MDI, {
        dose: '2',
        route: 'inhaled',
        frequency: 'every 4 hours as needed',
        durationDays: '7',
        instructions: 'with spacer.',
      })
    ).toBe('Inhale 2 puffs every 4 hours as needed for up to 7 days, with spacer.');
    expect(prescriptionDirectionsText(AZITHROMYCIN_TAB, { ...AZITHROMYCIN, instructions: 'with food' })).toBe(
      'Take 2 tablets by mouth once daily for 1 day, then 1 tablet by mouth once daily for 4 days, with food.'
    );
    expect(
      prescriptionDirectionsText(
        { doseForm: 'Topical Lotion' },
        {
          dose: '',
          route: 'on the skin',
          frequency: 'once daily',
          durationDays: '1',
          instructions: 'leave in 10 minutes then rinse; repeat in 7 days if needed',
        }
      )
    ).toBe('Apply on the skin once daily for 1 day, leave in 10 minutes then rinse; repeat in 7 days if needed.');
  });
});

describe('prescriptionDirectionsText', () => {
  it('reads the dose in the form’s unit, then the route, frequency and duration', () => {
    expect(
      prescriptionDirectionsText(AMOXICILLIN_250_SUSP, {
        dose: '5',
        route: 'by mouth',
        frequency: 'twice daily',
        durationDays: '10',
      })
    ).toBe('Take 5 mL by mouth twice daily for 10 days.');
    expect(
      prescriptionDirectionsText(AMOXICILLIN_875_TAB, {
        dose: '1',
        route: 'by mouth',
        frequency: 'at bedtime',
        durationDays: '1',
      })
    ).toBe('Take 1 tablet by mouth at bedtime for 1 day.');
  });

  it('lets the verb say the route for an inhaler, and reads an as-needed duration as "up to"', () => {
    expect(
      prescriptionDirectionsText(ALBUTEROL_MDI, {
        dose: '2',
        route: 'inhaled',
        frequency: 'every 4 hours as needed',
        durationDays: '5',
      })
    ).toBe('Inhale 2 puffs every 4 hours as needed for up to 5 days.');
  });

  it('counts ear drops in drops and leaves out what is not picked', () => {
    expect(
      prescriptionDirectionsText(OFLOXACIN_OTIC, {
        dose: '5',
        route: 'in the ear',
        frequency: '',
        durationDays: '',
      })
    ).toBe('Put 5 drops in the ear.');
    expect(
      prescriptionDirectionsText(MUPIROCIN_OINTMENT, {
        dose: '',
        route: 'on the skin',
        frequency: 'three times daily',
        durationDays: '7',
      })
    ).toBe('Apply on the skin three times daily for 7 days.');
  });

  it('says nothing until a dose or frequency is picked', () => {
    expect(
      prescriptionDirectionsText(AMOXICILLIN_875_TAB, {
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
      prescriptionDispense(AMOXICILLIN_250_SUSP, {
        dose: '7.5',
        route: 'by mouth',
        frequency: 'twice daily',
        durationDays: '10',
      })
    ).toEqual({ quantityValue: '150', daysSupply: '10' });
    expect(
      prescriptionDispense(AMOXICILLIN_875_TAB, {
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
    expect(prescriptionDispense(IBUPROFEN_TAB, directions)).toEqual({ quantityValue: '20', daysSupply: '5' });
    expect(prescriptionDispense(IBUPROFEN_TAB, { ...directions, frequency: 'as needed' })).toEqual({
      quantityValue: '',
      daysSupply: '5',
    });
  });

  it('dispenses one inhaler whatever the doses', () => {
    expect(
      prescriptionDispense(ALBUTEROL_MDI, {
        dose: '2',
        route: 'inhaled',
        frequency: 'every 4 hours as needed',
        durationDays: '30',
      })
    ).toEqual({ quantityValue: '1', daysSupply: '30' });
  });

  it('leaves the quantity of a cream or of drops to the provider', () => {
    expect(
      prescriptionDispense(MUPIROCIN_OINTMENT, {
        dose: '1',
        route: 'on the skin',
        frequency: 'three times daily',
        durationDays: '7',
      })
    ).toEqual({ quantityValue: '', daysSupply: '7' });
    expect(
      prescriptionDispense(OFLOXACIN_OTIC, {
        dose: '5',
        route: 'in the ear',
        frequency: 'twice daily',
        durationDays: '7',
      })
    ).toEqual({ quantityValue: '', daysSupply: '7' });
  });
});
