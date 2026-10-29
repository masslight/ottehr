import { CompoundIngredientInput, CompoundInput, QuantityUnit } from 'utils/lib/types/api/order-prescription.types';
import { describe, expect, it } from 'vitest';
import {
  applyPrescriptionQuickPick,
  compoundCalculatorProduct,
  compoundIngredientText,
  compoundLineOf,
  compoundOrderIngredients,
  compoundToOrder,
  emptyPrescriptionLine,
  ingredientText,
  maximumWarnings,
  mgPerMeasure,
  pickedStrength,
  PrescriptionLine,
  prescriptionLineErrors,
  prescriptionLineToOrder,
  prescriptionLineToQuickPick,
  withCalculatorDosing,
  withCompound,
  withCompoundDose,
  withDirections,
  withDrug,
  withoutCompound,
  withProduct,
  withSuggestion,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import { detailed, ERX_PRODUCT_DETAILS } from '../component/helpers/erxProducts';

const complete = (): PrescriptionLine => ({
  ...emptyPrescriptionLine(),
  medication: detailed({ ndc: '00093310901', description: 'Amoxicillin 500 MG Oral Capsule' }),
  route: 'by mouth',
  quantityValue: '20',
  quantityUnit: 'Capsule',
  daysSupply: '10',
  numberOfRefills: '0',
  patientInstructions: 'Take 1 capsule by mouth twice daily for 10 days.',
  diagnosis: { code: 'J02.9', display: 'Acute pharyngitis, unspecified' },
});

const PHARMACY = {
  ncpdpId: '0002026',
  npi: '1234567893',
  name: 'Sample Pharmacy One',
  phone: '5125559999',
  address: '123 Main St, Washington, DC 20001',
};

/** One drug in every form, as the terminology search returns it, with each strength's dose form and ingredients. */
const AMOXICILLIN = {
  name: 'Amoxicillin',
  strengths: [
    detailed({ strength: '250 mg Cap', ndcs: ['00093310701'] }),
    detailed({ strength: '875 mg Tab', ndcs: ['00093226401'] }),
    detailed({ strength: '250 mg/5ml Susp', ndcs: ['00093415573'] }),
    detailed({ strength: '400 mg/5ml Susp', ndcs: ['00093416173'] }),
  ],
};
const AMOXICILLIN_500_TAB = detailed({ strength: '500 mg Tab', ndcs: ['00093226301'] });

const MUPIROCIN = {
  name: 'Mupirocin (Topical)',
  strengths: [detailed({ strength: '2% Ointment', ndcs: ['00093101042'] })],
};

const ALBUTEROL = {
  name: 'Albuterol',
  strengths: [
    detailed({ strength: '90 mcg/puff MDI', ndcs: ['00054074287'] }),
    detailed({ strength: '0.083% Neb Soln', ndcs: ['00487950101'] }),
    detailed({ strength: '108 (90 Base) mcg/act HFA', ndcs: ['59310057922'] }),
  ],
};

/** A dose pack (RxNorm's "Pack", rxcui 2587899): its dose form says nothing of a unit or route. */
const PAXLOVID = {
  name: 'Paxlovid',
  strengths: [
    {
      strength: '300 mg-100 mg Dose Pack',
      ndcs: ['00069110104'],
      rxcui: '2587899',
      doseForm: 'Pack',
      ingredients: [
        { name: 'nirmatrelvir', amount: 150, unit: 'MG', per: 1, perUnit: 'EACH' },
        { name: 'ritonavir', amount: 100, unit: 'MG', per: 1, perUnit: 'EACH' },
      ],
    },
  ],
};

describe('prescriptionLineErrors', () => {
  it('names everything an empty line still needs, in sentence order', () => {
    expect(prescriptionLineErrors(emptyPrescriptionLine())).toEqual([
      'Pick a medication',
      'Quantity must be greater than 0',
      'Pick a unit',
      'Enter the directions',
    ]);
  });

  it('accepts a complete line, with or without a days supply', () => {
    expect(prescriptionLineErrors(complete())).toEqual([]);
    expect(prescriptionLineErrors({ ...complete(), daysSupply: '' })).toEqual([]);
  });

  it('rejects out-of-range refills and days supply', () => {
    expect(prescriptionLineErrors({ ...complete(), numberOfRefills: '100', daysSupply: '1.5' })).toEqual([
      'Days supply must be a whole number from 1 to 999',
      'Refills must be a whole number from 0 to 99',
    ]);
  });
});

describe('withDrug', () => {
  it('leaves the strength to the provider and drops what was written for the product before', () => {
    const liquid = withDirections(withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[2]), {
      dose: '5',
      frequency: 'twice daily',
    });
    const picked = withDrug(liquid, MUPIROCIN);
    expect(picked).toMatchObject({
      drug: MUPIROCIN,
      medication: null,
      dose: '',
      frequency: '',
      patientInstructions: '',
    });
    expect(pickedStrength(picked)).toBeUndefined();
    expect(prescriptionLineErrors(picked)).toContain('Pick a strength');
    expect(prescriptionLineErrors(picked)).not.toContain('Pick a medication');
    // The strength picked next names the product.
    expect(withProduct(picked, MUPIROCIN, MUPIROCIN.strengths[0]).medication?.description).toBe(
      'Mupirocin (Topical) 2% Ointment'
    );
  });
});

describe('withDrug: what the old product implied goes', () => {
  it('clears a typed quantity, the unit, days supply and route; the new product sets its own', () => {
    const liquid = withDirections(withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[2]), {
      dose: '5',
      frequency: 'twice daily',
      durationDays: '10',
    });
    // Typed by hand, so the blanks would never overwrite them.
    const typed = {
      ...liquid,
      quantityValue: '150',
      daysSupply: '7',
      numberOfRefills: '2',
      substitutionAllowed: false,
      noteToPharmacy: 'Shake well',
    };
    const picked = withDrug(typed, MUPIROCIN);
    expect(picked).toMatchObject({
      quantityValue: '',
      quantityUnit: '',
      daysSupply: '',
      route: '',
      dose: '',
      frequency: '',
      durationDays: '',
      patientInstructions: '',
      // Not the product's: the provider's refills, substitution and note stay.
      numberOfRefills: '2',
      substitutionAllowed: false,
      noteToPharmacy: 'Shake well',
    });
    expect(withProduct(picked, MUPIROCIN, MUPIROCIN.strengths[0])).toMatchObject({
      quantityUnit: 'Gram',
      route: 'on the skin',
      quantityValue: '',
    });
    // A product that implies no unit or route leaves them empty, not the old drug's.
    expect(withProduct(withDrug(typed, PAXLOVID), PAXLOVID, PAXLOVID.strengths[0])).toMatchObject({
      quantityUnit: '',
      route: '',
    });
  });
});

describe('combination products', () => {
  const AUGMENTIN = {
    name: 'Amoxicillin-Clavulanate',
    strengths: [
      detailed({ strength: '400-57 mg/5ml Susp', ndcs: ['00093227573'] }),
      detailed({ strength: '600-42.9 mg/5ml Susp', ndcs: ['00093227873'] }),
    ],
  };

  it('never re-measures a dose by the first ingredient: a strength change leaves the dose to enter', () => {
    const line = withDirections(withProduct(emptyPrescriptionLine(), AUGMENTIN, AUGMENTIN.strengths[0]), {
      dose: '5',
      frequency: 'twice daily',
    });
    const next = withProduct(line, AUGMENTIN, AUGMENTIN.strengths[1]);
    expect(next.dose).toBe('');
    expect(next.doseNotes).toEqual([undefined]);
  });

  it('checks no maximum until the calculator doses by one ingredient, then checks that one’s', () => {
    const line: PrescriptionLine = {
      ...withProduct(emptyPrescriptionLine(), AUGMENTIN, AUGMENTIN.strengths[0]),
      dose: '20',
      frequency: 'twice daily',
      maximum: { maxPerDoseMg: 500, from: 'calculator' },
    };
    expect(maximumWarnings(line)).toEqual([]);
    // 20 mL × 80 mg/mL amoxicillin = 1,600 mg; 20 mL × 11.4 mg/mL clavulanate = 228 mg.
    expect(maximumWarnings({ ...line, doseBy: 'amoxicillin' })).toEqual([
      { blank: 'dose', text: '1,600 mg per dose is above the 500 mg maximum.' },
    ]);
    expect(maximumWarnings({ ...line, doseBy: 'clavulanate' })).toEqual([]);
  });

  it('names each ingredient by its mg per measure, and has no mg of its own', () => {
    const product = withProduct(emptyPrescriptionLine(), AUGMENTIN, AUGMENTIN.strengths[0]).medication;
    expect(product?.ingredients?.map((ingredient) => ingredientText(product, ingredient))).toEqual([
      'amoxicillin 80 mg/mL',
      'clavulanate 11.4 mg/mL',
    ]);
    expect(mgPerMeasure(product)).toBeUndefined();
  });
});

describe('mgPerMeasure', () => {
  const product = (ndc: string): (typeof ERX_PRODUCT_DETAILS)[string] => ERX_PRODUCT_DETAILS[ndc];

  it('reads mg per mL of a liquid and per tablet or capsule from the one ingredient', () => {
    expect(mgPerMeasure(product('00093416173'))).toBe(80);
    expect(mgPerMeasure(product('00093310701'))).toBe(250);
    expect(mgPerMeasure(product('00093226401'))).toBe(875);
    expect(
      mgPerMeasure({
        doseForm: 'Oral Tablet',
        ingredients: [{ ...product('00093226401').ingredients![0], unit: 'GM', amount: 1 }],
      })
    ).toBe(1000);
    expect(
      mgPerMeasure({
        doseForm: 'Oral Suspension',
        ingredients: [{ name: 'x', amount: 400, unit: 'MCG', per: 5, perUnit: 'ML' }],
      })
    ).toBe(0.08);
  });

  it('has none for a form the calculator doesn’t measure, a unit that isn’t mg, or no details', () => {
    expect(mgPerMeasure(product('00054074287'))).toBeUndefined();
    expect(mgPerMeasure(product('00093101042'))).toBeUndefined();
    expect(
      mgPerMeasure({
        doseForm: 'Oral Suspension',
        ingredients: [{ name: 'x', amount: 1, unit: 'UNT', per: 1, perUnit: 'ML' }],
      })
    ).toBeUndefined();
    expect(
      mgPerMeasure({
        doseForm: 'Oral Tablet',
        ingredients: [{ name: 'x', amount: 1, unit: 'MG', per: 1, perUnit: 'ML' }],
      })
    ).toBeUndefined();
    expect(mgPerMeasure({ ndc: '00093416173', description: 'Amoxicillin 400 mg/5ml Susp' } as never)).toBeUndefined();
  });
});

describe('a product without structured details', () => {
  it('implies no unit or route, and no dose is re-measured into it', () => {
    const bare = { name: 'Amoxicillin', strengths: [{ strength: '400 mg/5ml Susp', ndcs: ['00093416173'] }] };
    const line = withProduct({ ...emptyPrescriptionLine(), quantityUnit: 'Each' }, bare, bare.strengths[0]);
    expect(line).toMatchObject({ quantityUnit: 'Each', route: '' });
    expect(withDirections(line, { dose: '5', frequency: 'twice daily' }).patientInstructions).toBe(
      'Take 5 twice daily.'
    );
  });
});

describe('withProduct', () => {
  it('names the product by drug and strength, with the unit and route from its dose form', () => {
    const line = withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[2]);
    expect(line.medication).toEqual({
      ndc: '00093415573',
      description: 'Amoxicillin 250 mg/5ml Susp',
      ...ERX_PRODUCT_DETAILS['00093415573'],
    });
    expect(line.quantityUnit).toBe('Milliliter');
    expect(line.route).toBe('by mouth');

    const ointment = withProduct(emptyPrescriptionLine(), MUPIROCIN, MUPIROCIN.strengths[0]);
    expect(ointment.quantityUnit).toBe('Gram');
    expect(ointment.route).toBe('on the skin');
  });

  it('leaves the unit and route alone when the product does not say', () => {
    const line = withProduct({ ...emptyPrescriptionLine(), quantityUnit: 'Each' }, PAXLOVID, PAXLOVID.strengths[0]);
    expect(line.quantityUnit).toBe('Each');
    expect(line.route).toBe('');
    // An auto-injector is by injection, in a unit the provider picks.
    const pen = {
      name: 'Epinephrine',
      strengths: [detailed({ strength: '0.3 mg Auto-Injector', ndcs: ['49502010202'] })],
    };
    expect(withProduct({ ...emptyPrescriptionLine(), quantityUnit: 'Each' }, pen, pen.strengths[0])).toMatchObject({
      quantityUnit: 'Each',
      route: 'by injection',
    });
  });

  it('keeps the picks across a strength change and rewrites the directions for the new strength', () => {
    const liquid = withDirections(withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[2]), {
      dose: '5',
      frequency: 'twice daily',
      durationDays: '10',
    });
    expect(liquid.patientInstructions).toBe('Take 5 mL by mouth twice daily for 10 days.');
    // 5 mL of 250/5 is 250 mg: 0.29 of an 875 mg tablet, which isn't split, so at least one whole tablet, with a
    // note on how far over it is: the provider decides, with no cut-off.
    const tablet = withProduct(liquid, AMOXICILLIN, AMOXICILLIN.strengths[1]);
    expect(tablet.quantityUnit).toBe('Tablet');
    expect(tablet.dose).toBe('1');
    expect(tablet.doseNotes).toEqual([{ dose: '1', text: '1 tablet = 875 mg, 625 mg (250%) over 250 mg' }]);
    expect(tablet.patientInstructions).toBe('Take 1 tablet by mouth twice daily for 10 days.');
    expect(tablet.quantityValue).toBe('20');
    // A tablet is given whole, as the calculator does: 250 mg is half a 500 mg tablet, rounded to one.
    const halves = withProduct(liquid, AMOXICILLIN, AMOXICILLIN_500_TAB);
    expect(halves.dose).toBe('1');
    expect(halves.doseNotes?.[0]?.text).toBe('1 tablet = 500 mg, 250 mg (100%) over 250 mg');
  });

  it('keeps the mg per dose across a strength change, to the nearest amount the new product measures', () => {
    const liquid = withDirections(withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[3]), {
      dose: '9.5',
      frequency: 'twice daily',
      durationDays: '10',
      steps: [{ dose: '4.75', frequency: 'twice daily', durationDays: '2' }],
    });
    // 9.5 mL of 400/5 is 760 mg: 15.2 mL of 250/5, to the half mL as the calculator measures; the "then" step
    // follows, each with its note.
    const weaker = withProduct(liquid, AMOXICILLIN, AMOXICILLIN.strengths[2]);
    expect(weaker.dose).toBe('15');
    expect(weaker.steps[0].dose).toBe('7.5');
    expect(weaker.doseNotes).toEqual([
      { dose: '15', text: '15 mL = 750 mg, 10 mg (1%) under 760 mg' },
      { dose: '7.5', text: '7.5 mL = 375 mg, 5 mg (1%) under 380 mg' },
    ]);
    expect(weaker.patientInstructions).toBe(
      'Take 15 mL by mouth twice daily for 10 days, then 7.5 mL by mouth twice daily for 2 days.'
    );
    // 760 mg in 875 mg tablets is 0.87: one whole tablet, 15% over, kept with its note (no cut-off).
    const tablets = withProduct(liquid, AMOXICILLIN, AMOXICILLIN.strengths[1]);
    expect(tablets.dose).toBe('1');
    expect(tablets.doseNotes?.[0]?.text).toBe('1 tablet = 875 mg, 115 mg (15%) over 760 mg');
    // The same strength again, or another drug, leaves no notes.
    expect(withProduct(tablets, AMOXICILLIN, AMOXICILLIN.strengths[1]).doseNotes).toBeUndefined();

    const albuterol = ALBUTEROL;
    const puffs = withDirections(withProduct(emptyPrescriptionLine(), albuterol, albuterol.strengths[0]), {
      dose: '2',
    });
    expect(withProduct(puffs, albuterol, albuterol.strengths[1])).toMatchObject({ dose: '', patientInstructions: '' });
    // Puffs aren't re-measured: another inhaler keeps the dose as it was.
    expect(withProduct(puffs, albuterol, albuterol.strengths[2])).toMatchObject({
      dose: '2',
      patientInstructions: 'Inhale 2 puffs.',
    });
  });

  it('drops the picks, steps, instructions and directions when another drug is picked', () => {
    const liquid = withDirections(withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[2]), {
      dose: '5',
      frequency: 'twice daily',
      durationDays: '1',
      steps: [{ dose: '2.5', frequency: 'once daily', durationDays: '4' }],
      instructions: 'with food',
    });
    const ointment = withProduct(liquid, MUPIROCIN, MUPIROCIN.strengths[0]);
    expect(ointment).toMatchObject({
      dose: '',
      frequency: '',
      patientInstructions: '',
      quantityValue: '',
      steps: [],
      instructions: '',
    });
  });
});

describe('withDirections', () => {
  const tablet = (): PrescriptionLine => withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[1]);

  it('writes the directions, quantity and days supply as the blanks are picked', () => {
    const line = withDirections(withDirections(tablet(), { dose: '1' }), {
      frequency: 'three times daily',
      durationDays: '7',
    });
    expect(line.patientInstructions).toBe('Take 1 tablet by mouth three times daily for 7 days.');
    expect(line.quantityValue).toBe('21');
    expect(line.daysSupply).toBe('7');
  });

  it('never overwrites directions or a quantity the provider typed', () => {
    const typed = {
      ...withDirections(tablet(), { dose: '1', frequency: 'twice daily', durationDays: '10' }),
      patientInstructions: 'Take 1 tablet by mouth twice daily with food for 10 days.',
      quantityValue: '30',
    };
    const line = withDirections(typed, { durationDays: '14' });
    expect(line.patientInstructions).toBe('Take 1 tablet by mouth twice daily with food for 10 days.');
    expect(line.quantityValue).toBe('30');
    expect(line.daysSupply).toBe('14');
  });

  it('adds up "then" steps, drops a removed one, and still leaves typed directions alone', () => {
    const first = withDirections(tablet(), { dose: '2', frequency: 'once daily', durationDays: '1' });
    const twoSteps = withDirections(first, { steps: [{ dose: '1', frequency: 'once daily', durationDays: '4' }] });
    expect(twoSteps.patientInstructions).toBe(
      'Take 2 tablets by mouth once daily for 1 day, then 1 tablet by mouth once daily for 4 days.'
    );
    expect(twoSteps.quantityValue).toBe('6');
    expect(twoSteps.daysSupply).toBe('5');

    const oneStep = withDirections(twoSteps, { steps: [] });
    expect(oneStep.patientInstructions).toBe('Take 2 tablets by mouth once daily for 1 day.');
    expect(oneStep.quantityValue).toBe('2');

    const typed = { ...first, patientInstructions: 'Take 2 tablets today.' };
    expect(withDirections(typed, { steps: twoSteps.steps }).patientInstructions).toBe('Take 2 tablets today.');
  });

  it('appends the instructions, and needs no dose for a device', () => {
    const spacer = { name: 'Spacer', strengths: [{ strength: 'Device', ndcs: ['00000000001'] }] };
    const line = withDirections(withProduct(emptyPrescriptionLine(), spacer, spacer.strengths[0]), {
      route: 'inhaled',
      instructions: 'with albuterol inhaler',
    });
    expect(line.patientInstructions).toBe('Inhale with albuterol inhaler.');
    expect(line.quantityValue).toBe('');
    expect(prescriptionLineErrors({ ...line, quantityValue: '1', quantityUnit: 'Each' })).toEqual([]);
  });

  it('fills an inhaler as one unit and leaves a cream’s quantity empty', () => {
    const albuterol = ALBUTEROL;
    const inhaler = withDirections(withProduct(emptyPrescriptionLine(), albuterol, albuterol.strengths[0]), {
      dose: '2',
      frequency: 'every 4 hours as needed',
      durationDays: '5',
    });
    expect(inhaler.patientInstructions).toBe('Inhale 2 puffs every 4 hours as needed for up to 5 days.');
    expect(inhaler.quantityValue).toBe('1');

    const cream = withDirections(withProduct(emptyPrescriptionLine(), MUPIROCIN, MUPIROCIN.strengths[0]), {
      frequency: 'three times daily',
      durationDays: '7',
    });
    expect(cream.patientInstructions).toBe('Apply on the skin three times daily for 7 days.');
    expect(cream.quantityValue).toBe('');
    expect(cream.daysSupply).toBe('7');
  });
});

describe('prescriptionLineToOrder', () => {
  it('builds one order with the shared pharmacy and written date, without the on-screen-only fields', () => {
    expect(
      prescriptionLineToOrder(
        { ...complete(), dose: '1', frequency: 'twice daily', durationDays: '10', urgent: true },
        {
          patientId: 'patient-1',
          practitionerId: 'practitioner-1',
          encounterId: 'encounter-1',
          pharmacy: PHARMACY,
          writtenDate: '2026-10-07',
        }
      )
    ).toEqual({
      patientId: 'patient-1',
      practitionerId: 'practitioner-1',
      encounterId: 'encounter-1',
      ndc: '00093310901',
      medicationDescription: 'Amoxicillin 500 MG Oral Capsule',
      quantityValue: 20,
      quantityUnit: 'Capsule',
      daysSupply: 10,
      writtenDate: '2026-10-07',
      substitutionAllowed: true,
      numberOfRefills: 0,
      patientInstructions: 'Take 1 capsule by mouth twice daily for 10 days.',
      pharmacyId: '0002026',
      pharmacyNpi: '1234567893',
      pharmacyName: 'Sample Pharmacy One',
      pharmacyPhone: '5125559999',
      diagnosisCode: 'J02.9',
      diagnosisDescription: 'Acute pharyngitis, unspecified',
    });
  });

  // "½" on screen, ASCII to the pharmacy.
  it('sends the directions the blanks wrote with ASCII fractions; the line keeps ½', () => {
    const line = withDirections(
      {
        ...complete(),
        medication: detailed({ ndc: '00093117401', description: 'Penicillin V Potassium 500 MG Oral Tablet' }),
        quantityUnit: 'Tablet',
        patientInstructions: '',
      },
      { dose: '0.5', frequency: 'twice daily', durationDays: '10', steps: [] }
    );
    const context = {
      patientId: 'patient-1',
      practitionerId: 'practitioner-1',
      encounterId: 'encounter-1',
      pharmacy: PHARMACY,
      writtenDate: '2026-10-07',
    };
    expect(line.patientInstructions).toBe('Take ½ tablet by mouth twice daily for 10 days.');
    expect(prescriptionLineToOrder(line, context).patientInstructions).toBe(
      'Take 1/2 tablet by mouth twice daily for 10 days.'
    );
    const stepped = withDirections(line, { dose: '1.5' });
    expect(prescriptionLineToOrder(stepped, context).patientInstructions).toBe(
      'Take 1 1/2 tablets by mouth twice daily for 10 days.'
    );
    // Directions the provider typed are sent as typed, apart from Unicode fractions.
    const typed = { ...line, patientInstructions: 'Take 1/2 tablet twice daily with food.' };
    expect(prescriptionLineToOrder(typed, context).patientInstructions).toBe('Take 1/2 tablet twice daily with food.');
    const typedUnicode = { ...line, patientInstructions: 'Take 1½ tablets, then ½ tablet' };
    expect(prescriptionLineToOrder(typedUnicode, context).patientInstructions).toBe(
      'Take 1 1/2 tablets, then 1/2 tablet'
    );
    expect(typedUnicode.patientInstructions).toBe('Take 1½ tablets, then ½ tablet');
    // Edited after the blanks wrote them, and a quick pick's directions, the same.
    const edited = { ...line, patientInstructions: `${line.patientInstructions} With food.` };
    expect(prescriptionLineToOrder(edited, context).patientInstructions).toBe(
      'Take 1/2 tablet by mouth twice daily for 10 days. With food.'
    );
    const picked = applyPrescriptionQuickPick(line, {
      id: 'qp',
      name: 'Pen VK',
      patientInstructions: 'Take ¾ tablet daily',
    });
    expect(
      prescriptionLineToOrder({ ...picked, quantityUnit: 'Tablet', quantityValue: '20' }, context).patientInstructions
    ).toBe('Take 3/4 tablet daily');
  });
});

describe('prescription quick picks', () => {
  it('round-trips a line with its diagnosis, which replaces the line’s', () => {
    const line = { ...complete(), substitutionAllowed: false };
    const quickPick = prescriptionLineToQuickPick(line, '  Amoxicillin 10 days  ');
    expect(quickPick.name).toBe('Amoxicillin 10 days');
    expect(quickPick.diagnosis).toEqual({ code: 'J02.9', display: 'Acute pharyngitis, unspecified' });

    const target = { ...emptyPrescriptionLine(), diagnosis: { code: 'R50.9', display: 'Fever, unspecified' } };
    const applied = applyPrescriptionQuickPick(target, { id: 'qp-1', ...quickPick });
    expect(applied).toEqual({
      ...line,
      key: target.key,
      quickPicked: { quantityValue: '20', daysSupply: '10', numberOfRefills: '0', noteToPharmacy: '' },
    });
  });

  it('saves no diagnosis from a line without one, and one without leaves the line’s diagnosis', () => {
    const quickPick = prescriptionLineToQuickPick({ ...complete(), diagnosis: null }, 'Amoxicillin');
    expect(quickPick).not.toHaveProperty('diagnosis');

    const fever = { code: 'R50.9', display: 'Fever, unspecified' };
    expect(applyPrescriptionQuickPick({ ...emptyPrescriptionLine(), diagnosis: fever }, quickPick).diagnosis).toEqual(
      fever
    );
    expect(applyPrescriptionQuickPick(emptyPrescriptionLine(), quickPick).diagnosis).toBeNull();
  });

  it('starts the blanks empty, so they never overwrite the quick pick’s directions', () => {
    const applied = applyPrescriptionQuickPick(emptyPrescriptionLine(), {
      id: 'qp-1',
      ...prescriptionLineToQuickPick(complete(), 'Amoxicillin'),
    });
    expect(applied).toMatchObject({ route: 'by mouth', dose: '', frequency: '', durationDays: '' });
    expect(withDirections(applied, { dose: '2' }).patientInstructions).toBe(
      'Take 1 capsule by mouth twice daily for 10 days.'
    );
  });
});

describe('withSuggestion', () => {
  const fields = {
    dose: '',
    route: 'by mouth' as const,
    frequency: 'twice daily',
    durationDays: '10',
    steps: [],
    instructions: '',
    quantityValue: '',
    quantityUnit: '' as const,
    daysSupply: '10',
    numberOfRefills: '0',
    patientInstructions: 'Take by mouth twice daily for 10 days.',
  };
  const liquid = withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[3]);

  it('fills the blanks as generated and keeps the unit when the suggestion has none', () => {
    const line = withSuggestion(liquid, { ...fields, dose: '4.5' });
    expect(line).toMatchObject({
      ...fields,
      dose: '4.5',
      quantityUnit: 'Milliliter',
      generated: { patientInstructions: fields.patientInstructions, quantityValue: '', daysSupply: '10' },
    });
    // The calculator then writes the dose into the blank, and the directions follow.
    expect(withDirections(line, { dose: '5.75' }).patientInstructions).toBe(
      'Take 5.75 mL by mouth twice daily for 10 days.'
    );
  });

  it('leaves the line’s diagnosis', () => {
    const fever = { code: 'R50.9', display: 'Fever, unspecified' };
    expect(withSuggestion({ ...liquid, diagnosis: fever }, fields).diagnosis).toEqual(fever);
    expect(withSuggestion(liquid, fields).diagnosis).toBeNull();
  });
});

describe('product changes and suggestions', () => {
  it('picking another drug after a quick pick clears the quick pick’s quantity, days supply, refills and note', () => {
    const applied = applyPrescriptionQuickPick(emptyPrescriptionLine(), {
      id: 'qp-1',
      ...prescriptionLineToQuickPick(
        { ...complete(), numberOfRefills: '2', noteToPharmacy: 'Dispense in original bottle' },
        'Amoxicillin'
      ),
    });
    expect(applied).toMatchObject({ quantityValue: '20', daysSupply: '10', numberOfRefills: '2' });
    const other = withProduct(applied, MUPIROCIN, MUPIROCIN.strengths[0]);
    expect(other).toMatchObject({ quantityValue: '', daysSupply: '', numberOfRefills: '0', noteToPharmacy: '' });
    // What the provider changed after the quick pick stays theirs.
    const edited = withProduct({ ...applied, numberOfRefills: '1' }, MUPIROCIN, MUPIROCIN.strengths[0]);
    expect(edited.numberOfRefills).toBe('1');
  });

  it('re-measures to the calculator’s steps: a whole tablet, mL to the half', () => {
    const liquid = (strength: number, dose: string): PrescriptionLine =>
      withDirections(withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[strength]), {
        dose,
        frequency: 'twice daily',
      });
    // 8.75 mL of 250/5 is 437.5 mg: half an 875 mg tablet, which is given whole: one, 100% over, with its note.
    expect(withProduct(liquid(2, '8.75'), AMOXICILLIN, AMOXICILLIN.strengths[1])).toMatchObject({
      dose: '1',
      doseNotes: [{ dose: '1', text: '1 tablet = 875 mg, 437.5 mg (100%) over 437.5 mg' }],
    });
    // 5 mL of 250/5 is 250 mg: a 500 mg tablet is given whole, one.
    expect(withProduct(liquid(2, '5'), AMOXICILLIN, AMOXICILLIN_500_TAB).dose).toBe('1');
    // 9.5 mL of 400/5 is 760 mg: 15.2 mL of 250/5, measured to the half mL (98.7%).
    expect(withProduct(liquid(3, '9.5'), AMOXICILLIN, AMOXICILLIN.strengths[2]).dose).toBe('15');
  });

  it('does not require a route, which the order does not send', () => {
    expect(prescriptionLineErrors({ ...complete(), route: '' })).toEqual([]);
  });

  it('a suggestion keeps the provider’s refills', () => {
    const line = withProduct(
      { ...emptyPrescriptionLine(), numberOfRefills: '2' },
      AMOXICILLIN,
      AMOXICILLIN.strengths[3]
    );
    const suggested = withSuggestion(line, {
      dose: '4.5',
      route: 'by mouth',
      frequency: 'twice daily',
      durationDays: '10',
      steps: [],
      instructions: '',
      quantityValue: '',
      quantityUnit: '',
      daysSupply: '10',
      numberOfRefills: '0',
      patientInstructions: 'Take 4.5 mL by mouth twice daily for 10 days.',
    });
    expect(suggested.numberOfRefills).toBe('2');
  });
});

describe('withCalculatorDosing', () => {
  // Nothing typed into the directions or dispense blanks, so they follow.
  const dosed: PrescriptionLine = {
    ...complete(),
    patientInstructions: '',
    quantityValue: '',
    daysSupply: '',
    dose: '3',
    frequency: 'twice daily',
    dosing: { rate: 25, basis: 'mg/kg/dose' },
  };
  /** A blank changed on the line, as the dose and frequency blanks do it. */
  const changed = (line: PrescriptionLine, patch: Partial<PrescriptionLine>, kg?: number): PrescriptionLine =>
    withDirections(withCalculatorDosing(line, patch, kg), patch);
  // 400 mg/5 mL = 80 mg/mL; 20 kg × 80 mg/kg/day ÷ 2 = 800 mg = 10 mL.
  const perDay: PrescriptionLine = {
    ...complete(),
    patientInstructions: '',
    quantityValue: '',
    daysSupply: '',
    medication: detailed({ ndc: '00093416173', description: 'Amoxicillin 400 mg/5ml Susp' }),
    quantityUnit: 'Milliliter',
    dose: '10',
    frequency: 'twice daily',
    durationDays: '10',
    dosing: { rate: 80, basis: 'mg/kg/day' },
  };

  it('keeps the settings while the dose and the doses a day stay the calculator’s', () => {
    expect(withCalculatorDosing(dosed, { durationDays: '10' }, 20)).toBe(dosed);
    expect(withCalculatorDosing(dosed, { frequency: 'every 12 hours' }, 20)).toBe(dosed);
    expect(withCalculatorDosing(dosed, { dose: '3' }, 20)).toBe(dosed);
    // A frequency with no doses a day says nothing new to work from.
    expect(withCalculatorDosing(dosed, { frequency: 'as needed' }, 20)).toBe(dosed);
  });

  it('drops them for a typed dose', () => {
    expect(withCalculatorDosing(dosed, { dose: '4' }, 20).dosing).toBeUndefined();
  });

  it('mg/kg/dose: keeps the rate and the per-dose amount for a frequency of other doses a day; a quick pick saves it', () => {
    const next = changed(dosed, { frequency: 'three times daily' }, 20);
    expect(next).toMatchObject({
      dose: '3',
      frequency: 'three times daily',
      dosing: { rate: 25, basis: 'mg/kg/dose' },
      patientInstructions: 'Take 3 capsules by mouth three times daily.',
    });
    expect(next.doseNotes).toBeUndefined();
    expect(prescriptionLineToQuickPick(next, 'Dosed').dosing).toEqual({
      rate: 25,
      basis: 'mg/kg/dose',
      frequency: 'three times daily',
    });
  });

  it('mg/kg/day: works the per-dose amount out again for the new doses a day, with the working behind the ⓘ', () => {
    const next = changed(perDay, { frequency: 'three times daily' }, 20);
    expect(next).toMatchObject({
      dose: '6.5',
      frequency: 'three times daily',
      dosing: { rate: 80, basis: 'mg/kg/day' },
      patientInstructions: 'Take 6.5 mL by mouth three times daily for 10 days.',
      quantityValue: '195',
    });
    expect(next.doseNotes).toEqual([
      {
        dose: '6.5',
        working: '20 kg × 80 mg/kg/day ÷ 3 = 533.33 mg',
        text: '6.5 mL = 520 mg, 13.3 mg (2%) under 533.33 mg',
      },
    ]);
    expect(prescriptionLineToQuickPick(next, 'Per day').dosing).toEqual({
      rate: 80,
      basis: 'mg/kg/day',
      frequency: 'three times daily',
      durationDays: 10,
    });
    // Back to twice daily: 10 mL again, measured exactly, so no rounding note.
    expect(changed(next, { frequency: 'twice daily' }, 20)).toMatchObject({
      dose: '10',
      doseNotes: [{ dose: '10', working: '20 kg × 80 mg/kg/day ÷ 2 = 800 mg → 10 mL = 800 mg', text: '' }],
    });
  });

  it('mg/kg/day: keeps to the maximum, measuring down, and leaves the dose blank without a weight', () => {
    const capped = { ...perDay, dosing: { ...perDay.dosing!, maxPerDoseMg: 500 } };
    const next = changed(capped, { frequency: 'three times daily' }, 20);
    expect(next.dose).toBe('6');
    expect(next.doseNotes?.[0]?.working).toBe('20 kg × 80 mg/kg/day ÷ 3 = 533.33 mg → capped at 500 mg per dose');
    expect(next.dosing).toEqual({ rate: 80, basis: 'mg/kg/day', maxPerDoseMg: 500 });
    const noWeight = changed(perDay, { frequency: 'three times daily' });
    expect(noWeight).toMatchObject({ dose: '', dosing: { rate: 80, basis: 'mg/kg/day' } });
  });

  it('drops them on a new product and saves none for a course', () => {
    expect(withDrug(dosed, { name: 'Cefdinir', strengths: [] }).dosing).toBeUndefined();
    const course = { ...dosed, steps: [{ dose: '1', frequency: 'once daily', durationDays: '2' }] };
    expect(prescriptionLineToQuickPick(course, 'Course')).not.toHaveProperty('dosing');
    expect(prescriptionLineToQuickPick(dosed, 'Dosed').dosing).toEqual({ ...dosed.dosing, frequency: 'twice daily' });
  });
});

describe('maximumWarnings', () => {
  const liquid = (patch: Partial<PrescriptionLine>): PrescriptionLine => ({
    ...emptyPrescriptionLine(),
    medication: detailed({ ndc: '00093416173', description: 'Amoxicillin 400 mg/5ml Susp' }),
    maximum: { maxPerDoseMg: 500, maxPerDayMg: 1000, from: 'calculator' },
    ...patch,
  });

  it('warns per dose and per day from the dose in mg and the frequency’s doses a day', () => {
    expect(maximumWarnings(liquid({ dose: '10', frequency: 'twice daily' }))).toEqual([
      { blank: 'dose', text: '800 mg per dose is above the 500 mg maximum.' },
      { blank: 'frequency', text: '1,600 mg a day is above the 1,000 mg a day maximum.' },
    ]);
    // At the maximum is not above it.
    expect(maximumWarnings(liquid({ dose: '6.25', frequency: 'twice daily' }))).toEqual([]);
    // An as-needed frequency with a count still counts its doses.
    expect(maximumWarnings(liquid({ dose: '6', frequency: 'every 6 hours as needed' }))).toEqual([
      { blank: 'frequency', text: '1,920 mg a day is above the 1,000 mg a day maximum.' },
    ]);
  });

  it('has nothing to say without a maximum, a dose, a count of doses, or a form measured in mg', () => {
    expect(maximumWarnings(liquid({ dose: '10', maximum: undefined }))).toEqual([]);
    expect(maximumWarnings(liquid({ dose: '' }))).toEqual([]);
    expect(maximumWarnings(liquid({ dose: '6', frequency: 'as needed' }))).toEqual([]);
    expect(
      maximumWarnings(
        liquid({ dose: '20', medication: detailed({ ndc: '00054074287', description: 'Albuterol 90 mcg/puff MDI' }) })
      )
    ).toEqual([]);
  });

  it('goes with a new drug or strength', () => {
    const line = withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[0]);
    const maxed = { ...line, maximum: { maxPerDoseMg: 500, from: 'calculator' as const } };
    expect(withProduct(maxed, AMOXICILLIN, AMOXICILLIN.strengths[1]).maximum).toBeUndefined();
    expect(withDrug(maxed, AMOXICILLIN).maximum).toBeUndefined();
    // The same strength again keeps it.
    expect(withProduct(maxed, AMOXICILLIN, AMOXICILLIN.strengths[0]).maximum).toEqual(maxed.maximum);
  });

  it('outlives a dose typed over the calculator’s, which drops the settings', () => {
    const line = {
      ...emptyPrescriptionLine(),
      dose: '6',
      dosing: { rate: 25, basis: 'mg/kg/dose' as const, maxPerDoseMg: 500 },
      maximum: { maxPerDoseMg: 500, from: 'calculator' as const },
    };
    const typed = withCalculatorDosing(line, { dose: '10' }, 28.12);
    expect(typed.dosing).toBeUndefined();
    expect(typed.maximum).toEqual(line.maximum);
  });
});

describe('compound helpers', () => {
  // Test codes are made up.
  const CREAM: CompoundInput = {
    description: 'Ketoprofen cream',
    ingredients: [
      { description: 'Ketoprofen Powder', ndc: '00000000001', rxcui: '1001', strength: { value: 10, unit: '%' } },
      { description: 'Omeprazole', typedNotControlled: true, strength: { value: 2.5, unit: 'mg/mL' } },
      { description: 'Gabapentin Powder', ndc: '00000000002', amount: { value: 1, unit: 'Gram' } },
      { description: 'Cream base', typedNotControlled: true, base: true },
    ],
  };

  it('turns a saved or sent compound into the line’s rows and back unchanged', () => {
    expect(compoundToOrder(compoundLineOf(CREAM))).toEqual(CREAM);
  });

  it('reads each ingredient with its strength, amount or base', () => {
    expect(CREAM.ingredients.map(compoundIngredientText)).toEqual([
      'Ketoprofen Powder 10%',
      'Omeprazole 2.5 mg/mL',
      'Gabapentin Powder 1 gram',
      'Cream base base',
    ]);
    expect(compoundIngredientText({ description: 'Lidocaine' })).toBe('Lidocaine');
  });

  it('doses a compound as a liquid of its one mg/mL ingredient, and none with no or several', () => {
    const line = compoundLineOf(CREAM);
    expect(compoundCalculatorProduct(line)).toEqual({
      ndc: '',
      description: 'Ketoprofen cream',
      doseForm: 'Oral Solution',
      ingredients: [{ name: 'Omeprazole', amount: 2.5, unit: 'MG', per: 1, perUnit: 'ML' }],
    });
    expect(mgPerMeasure(compoundCalculatorProduct(line))).toBe(2.5);
    const [first, mgPerMl] = line.ingredients;
    expect(compoundCalculatorProduct({ ...line, ingredients: [first] })).toBeUndefined();
    expect(compoundCalculatorProduct({ ...line, ingredients: [mgPerMl, { ...mgPerMl, key: -1 }] })).toBeUndefined();
  });

  it('puts the calculator’s sentence first in the directions, replacing its last one and keeping the rest', () => {
    const line = { ...withCompound(emptyPrescriptionLine(), {}), compound: compoundLineOf(CREAM) };
    const dosed = (sentence: string): PrescriptionLine => ({
      ...line,
      generated: { ...line.generated, patientInstructions: sentence },
    });
    const once = withCompoundDose({ ...line, patientInstructions: 'Shake well.' }, dosed('Take 5 mL twice daily.'));
    expect(once.patientInstructions).toBe('Take 5 mL twice daily. Shake well.');
    const twice = withCompoundDose(once, dosed('Take 4 mL twice daily.'));
    expect(twice.patientInstructions).toBe('Take 4 mL twice daily. Shake well.');
    expect(twice.compound).toBe(line.compound);
  });

  it('goes back to an empty prescription keeping the refills, note, diagnosis and urgent flag', () => {
    const line = {
      ...withCompound(emptyPrescriptionLine(), {}),
      numberOfRefills: '3',
      noteToPharmacy: 'Call',
      urgent: true,
      diagnosis: { code: 'M25.50', display: 'Pain in unspecified joint' },
      patientInstructions: 'Apply.',
    };
    const back = withoutCompound(line);
    expect(back.compound).toBeUndefined();
    expect(back).toMatchObject({ key: line.key, numberOfRefills: '3', noteToPharmacy: 'Call', urgent: true });
    expect(back.diagnosis).toEqual(line.diagnosis);
    expect(back.patientInstructions).toBe('');
  });
});

// Review #2: a line never holds both a product and a compound; the compound would be what's sent.
describe('a product and a compound on one line', () => {
  const COMPOUND_PICK = {
    id: 'qp-cream',
    name: 'Pain cream',
    compound: {
      description: 'Ketoprofen cream',
      ingredients: [
        { description: 'Ketoprofen Powder', ndc: '00000000001', strength: { value: 10, unit: '%' as const } },
      ],
    },
    quantityValue: 60,
    quantityUnit: 'Gram' as const,
    patientInstructions: 'Apply twice daily.',
  };

  it('a compound quick pick applied while a drug waits for its strength clears the drug', () => {
    const applied = applyPrescriptionQuickPick(withDrug(emptyPrescriptionLine(), AMOXICILLIN), COMPOUND_PICK);
    expect(applied.drug).toBeNull();
    expect(applied.medication).toBeNull();
    expect(applied.compound?.name).toBe('Ketoprofen cream');
  });

  it('a product picked on a compound line ends the compound', () => {
    const compoundLine = applyPrescriptionQuickPick(emptyPrescriptionLine(), COMPOUND_PICK);
    const withStrength = withProduct(compoundLine, AMOXICILLIN, AMOXICILLIN.strengths[0]);
    expect(withStrength.compound).toBeUndefined();
    expect(withDrug(compoundLine, AMOXICILLIN).compound).toBeUndefined();
    const order = prescriptionLineToOrder(
      { ...withStrength, numberOfRefills: '0' },
      {
        patientId: 'patient-1',
        practitionerId: 'practitioner-1',
        encounterId: 'encounter-1',
        pharmacy: PHARMACY,
        writtenDate: '2026-10-28',
      }
    );
    expect(order).toMatchObject({ ndc: '00093310701' });
    expect(order).not.toHaveProperty('compound');
  });
});

// Review #5: an empty or zero mg/mL concentration is nothing to dose by.
describe('the compound calculator’s concentration', () => {
  const withMgPerMl = (value: string): ReturnType<typeof compoundLineOf> => {
    const line = compoundLineOf({
      description: 'Omeprazole suspension',
      ingredients: [{ description: 'Omeprazole', typedNotControlled: true, strength: { value: 2, unit: 'mg/mL' } }],
    });
    return { ...line, ingredients: [{ ...line.ingredients[0], value }] };
  };

  it('is offered only for a positive number', () => {
    for (const value of ['', '0', '-1', 'abc']) expect(compoundCalculatorProduct(withMgPerMl(value))).toBeUndefined();
    expect(compoundCalculatorProduct(withMgPerMl('2'))?.ingredients?.[0].amount).toBe(2);
  });
});

describe('compoundOrderIngredients: each ingredient as the amount that goes in', () => {
  const compound = (...ingredients: CompoundIngredientInput[]): CompoundInput => ({
    description: 'Test compound',
    dosageForm: 'Cream',
    ingredients,
  });
  const convert = (
    ingredients: CompoundIngredientInput[],
    value: number,
    unit: QuantityUnit
  ): ReturnType<typeof compoundOrderIngredients> => compoundOrderIngredients(compound(...ingredients), { value, unit });
  const amounts = (result: ReturnType<typeof compoundOrderIngredients>): [number, QuantityUnit][] =>
    'ingredients' in result
      ? result.ingredients.map((ingredient) => [ingredient.quantityValue, ingredient.quantityUnit])
      : [];

  it('sends an amount as is, with its NDC, and never an RxCUI or the not-controlled confirmation', () => {
    expect(
      convert(
        [
          { description: 'Ketoprofen Powder', ndc: '00000000001', rxcui: '1001', amount: { value: 6, unit: 'Gram' } },
          { description: 'Typed', typedNotControlled: true, amount: { value: 2, unit: 'Capsule' } },
        ],
        30,
        'Gram'
      )
    ).toEqual({
      ingredients: [
        { description: 'Ketoprofen Powder', ndc: '00000000001', quantityValue: 6, quantityUnit: 'Gram' },
        { description: 'Typed', quantityValue: 2, quantityUnit: 'Capsule' },
      ],
    });
  });

  it('works out a % of a total in grams, in grams, sending the strength as a Percentage', () => {
    expect(convert([{ description: 'K', strength: { value: 10, unit: '%' } }], 30, 'Gram')).toEqual({
      ingredients: [
        { description: 'K', strength: { value: '10', unit: 'Percentage' }, quantityValue: 3, quantityUnit: 'Gram' },
      ],
    });
  });

  it('works out mg/mL of a total in mL, in milligrams, sending the strength as mg/ml', () => {
    expect(convert([{ description: 'O', strength: { value: 2, unit: 'mg/mL' } }], 150, 'Milliliter')).toEqual({
      ingredients: [
        { description: 'O', strength: { value: '2', unit: 'mg/ml' }, quantityValue: 300, quantityUnit: 'Milligram' },
      ],
    });
  });

  it('works out mg/g of a total in grams, in milligrams, sending no strength', () => {
    expect(convert([{ description: 'L', strength: { value: 50, unit: 'mg/g' } }], 30, 'Gram')).toEqual({
      ingredients: [{ description: 'L', quantityValue: 1500, quantityUnit: 'Milligram' }],
    });
  });

  it.each(['Capsule', 'Tablet', 'Troche', 'Suppository', 'Lozenge', 'Each'] as const)(
    'works out mg each of a count in %s, in milligrams, sending the strength in Milligram',
    (unit) => {
      expect(convert([{ description: 'P', strength: { value: 75, unit: 'mg each' } }], 30, unit)).toEqual({
        ingredients: [
          {
            description: 'P',
            strength: { value: '75', unit: 'Milligram' },
            quantityValue: 2250,
            quantityUnit: 'Milligram',
          },
        ],
      });
    }
  );

  it('works out the base as the total in grams less the others, counting milligrams as thousandths', () => {
    const result = convert(
      [
        { description: 'K', strength: { value: 10, unit: '%' } },
        { description: 'L', strength: { value: 50, unit: 'mg/g' } },
        { description: 'G', amount: { value: 600, unit: 'Milligram' } },
        { description: 'Base', base: true },
      ],
      30,
      'Gram'
    );
    expect(amounts(result)).toEqual([
      [3, 'Gram'],
      [1500, 'Milligram'],
      [600, 'Milligram'],
      [24.9, 'Gram'],
    ]);
    expect('ingredients' in result && result.ingredients[3]).toEqual({
      description: 'Base',
      quantityValue: 24.9,
      quantityUnit: 'Gram',
    });
  });

  it('works out the base as the total in mL less the others in mL', () => {
    expect(
      amounts(
        convert(
          [
            { description: 'A', amount: { value: 12.5, unit: 'Milliliter' } },
            { description: 'Base', base: true },
          ],
          100,
          'Milliliter'
        )
      )
    ).toEqual([
      [12.5, 'Milliliter'],
      [87.5, 'Milliliter'],
    ]);
  });

  it('rounds away float noise', () => {
    expect(
      amounts(
        convert(
          [
            { description: 'A', strength: { value: 0.1, unit: '%' } },
            { description: 'B', strength: { value: 7, unit: '%' } },
            { description: 'Base', base: true },
          ],
          30,
          'Gram'
        )
      )
    ).toEqual([
      [0.03, 'Gram'],
      [2.1, 'Gram'],
      [27.87, 'Gram'],
    ]);
  });

  it.each([
    ['%', 'Milliliter', "Enter an amount for ingredient 1 — a % can't be worked out from a total in mL"],
    ['mg/mL', 'Gram', "Enter an amount for ingredient 1 — mg/mL can't be worked out from a total in g"],
    ['mg/g', 'Milliliter', "Enter an amount for ingredient 1 — mg/g can't be worked out from a total in mL"],
    ['mg each', 'Gram', "Enter an amount for ingredient 1 — mg each can't be worked out from a total in g"],
    ['%', 'Capsule', "Enter an amount for ingredient 1 — a % can't be worked out from a total in capsules"],
  ] as const)('refuses a strength in %s of a total in %s', (unit, totalUnit, error) => {
    expect(convert([{ description: 'X', strength: { value: 2, unit } }], 30, totalUnit)).toEqual({ errors: [error] });
  });

  it('refuses the base of a total that isn’t in grams or mL', () => {
    expect(
      convert(
        [
          { description: 'P', strength: { value: 75, unit: 'mg each' } },
          { description: 'Base', base: true },
        ],
        30,
        'Capsule'
      )
    ).toEqual({
      errors: ["Enter an amount for ingredient 2 — the base can't be worked out from a total in capsules"],
    });
  });

  it('refuses the base when another ingredient isn’t in the total’s unit', () => {
    const error = "Enter an amount for ingredient 1 — the base can't be worked out when another ingredient isn't in mL";
    // Milligrams count toward grams only; mL only with mL.
    for (const amount of [
      { value: 5, unit: 'Gram' },
      { value: 5, unit: 'Milligram' },
    ] as const) {
      expect(
        convert(
          [
            { description: 'Base', base: true },
            { description: 'A', amount },
          ],
          100,
          'Milliliter'
        )
      ).toEqual({ errors: [error] });
    }
    expect(
      convert(
        [
          { description: 'A', amount: { value: 1, unit: 'Capsule' } },
          { description: 'Base', base: true },
        ],
        30,
        'Gram'
      )
    ).toEqual({
      errors: ["Enter an amount for ingredient 2 — the base can't be worked out when another ingredient isn't in g"],
    });
  });

  it('names only the ingredient that can’t be worked out, not the base it leaves unknown', () => {
    expect(
      convert(
        [
          { description: 'K', strength: { value: 10, unit: '%' } },
          { description: 'Base', base: true },
        ],
        100,
        'Milliliter'
      )
    ).toEqual({ errors: ["Enter an amount for ingredient 1 — a % can't be worked out from a total in mL"] });
  });

  it('refuses a base the other ingredients leave nothing for', () => {
    for (const value of [30, 31]) {
      expect(
        convert(
          [
            { description: 'A', amount: { value, unit: 'Gram' } },
            { description: 'Base', base: true },
          ],
          30,
          'Gram'
        )
      ).toEqual({ errors: ['Ingredient 2 is the base, but the other ingredients already make up the total'] });
    }
  });
});
