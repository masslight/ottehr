import { describe, expect, it } from 'vitest';
import {
  ageAtVisit,
  applyPrescriptionQuickPick,
  defaultStrength,
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineErrors,
  prescriptionLineToOrder,
  prescriptionLineToQuickPick,
  withDirections,
  withProduct,
  withSuggestion,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';

const complete = (): PrescriptionLine => ({
  ...emptyPrescriptionLine(),
  medication: { ndc: '00093310901', description: 'Amoxicillin 500 MG Oral Capsule' },
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

/** One drug in every form, as the terminology search returns it. */
const AMOXICILLIN = {
  name: 'Amoxicillin',
  strengths: [
    { strength: '250 mg Cap', ndcs: ['00093310701'] },
    { strength: '875 mg Tab', ndcs: ['00093226401'] },
    { strength: '250 mg/5ml Susp', ndcs: ['00093415573'] },
    { strength: '400 mg/5ml Susp', ndcs: ['00093416173'] },
  ],
};

const MUPIROCIN = { name: 'Mupirocin (Topical)', strengths: [{ strength: '2% Ointment', ndcs: ['00093101042'] }] };

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

describe('ageAtVisit', () => {
  it('counts whole years from the date of birth to the visit', () => {
    expect(ageAtVisit('2017-10-23', '2026-10-22T14:00:00.000Z')).toBe(8);
    expect(ageAtVisit('2017-10-22', '2026-10-22T14:00:00.000Z')).toBe(9);
    expect(ageAtVisit(undefined, '2026-10-22')).toBeUndefined();
  });
});

describe('defaultStrength', () => {
  it('starts a child under 9 on the first liquid and anyone else on the first solid', () => {
    expect(defaultStrength(AMOXICILLIN, 8).strength).toBe('250 mg/5ml Susp');
    expect(defaultStrength(AMOXICILLIN, 9).strength).toBe('250 mg Cap');
    expect(defaultStrength(AMOXICILLIN, undefined).strength).toBe('250 mg Cap');
  });

  it('falls back to the first strength when the drug has no such form', () => {
    expect(defaultStrength(MUPIROCIN, 3).strength).toBe('2% Ointment');
  });

  it('starts on an immediate-release strength before a delayed- or extended-release one', () => {
    const prednisone = {
      name: 'predniSONE',
      strengths: ['1 mg DR Tab', '1 mg Tab', '2 mg DR Tab', '5 mg Tab'].map((strength, i) => ({
        strength,
        ndcs: [`0000000000${i}`],
      })),
    };
    expect(defaultStrength(prednisone, 30).strength).toBe('1 mg Tab');
    const onlyDelayed = { name: 'Pantoprazole', strengths: [{ strength: '40 mg DR Tab', ndcs: ['00000000009'] }] };
    expect(defaultStrength(onlyDelayed, 30).strength).toBe('40 mg DR Tab');
    const extended = {
      name: 'Guaifenesin',
      strengths: [
        { strength: '600 mg ER Tab', ndcs: ['00000000011'] },
        { strength: '400 mg Tab', ndcs: ['00000000012'] },
      ],
    };
    expect(defaultStrength(extended, 30).strength).toBe('400 mg Tab');
  });
});

describe('withProduct', () => {
  it('names the product by drug and strength, with the unit and route read from them', () => {
    const line = withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[2]);
    expect(line.medication).toEqual({ ndc: '00093415573', description: 'Amoxicillin 250 mg/5ml Susp' });
    expect(line.quantityUnit).toBe('Milliliter');
    expect(line.route).toBe('by mouth');

    const ointment = withProduct(emptyPrescriptionLine(), MUPIROCIN, MUPIROCIN.strengths[0]);
    expect(ointment.quantityUnit).toBe('Gram');
    expect(ointment.route).toBe('on the skin');
  });

  it('leaves the unit and route alone when the product does not say', () => {
    const pen = { name: 'Epinephrine', strengths: [{ strength: '0.3 mg Auto-Injector', ndcs: ['49502010202'] }] };
    const line = withProduct({ ...emptyPrescriptionLine(), quantityUnit: 'Each' }, pen, pen.strengths[0]);
    expect(line.quantityUnit).toBe('Each');
    expect(line.route).toBe('');
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
    const halves = withProduct(liquid, AMOXICILLIN, { strength: '500 mg Tab', ndcs: ['00093226301'] });
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

    const albuterol = {
      name: 'Albuterol',
      strengths: [
        { strength: '90 mcg/puff MDI', ndcs: ['00054074287'] },
        { strength: '0.083% Neb Soln', ndcs: ['00487950101'] },
        { strength: '108 (90 Base) mcg/act HFA', ndcs: ['59310057922'] },
      ],
    };
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

  it('drops the picks and directions when another drug is picked', () => {
    const liquid = withDirections(withProduct(emptyPrescriptionLine(), AMOXICILLIN, AMOXICILLIN.strengths[2]), {
      dose: '5',
      frequency: 'twice daily',
    });
    const ointment = withProduct(liquid, MUPIROCIN, MUPIROCIN.strengths[0]);
    expect(ointment).toMatchObject({ dose: '', frequency: '', patientInstructions: '', quantityValue: '' });
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

  it('starts over on steps and instructions when another drug is picked', () => {
    const taper = withDirections(tablet(), {
      dose: '2',
      frequency: 'once daily',
      durationDays: '1',
      steps: [{ dose: '1', frequency: 'once daily', durationDays: '4' }],
      instructions: 'with food',
    });
    expect(withProduct(taper, MUPIROCIN, MUPIROCIN.strengths[0])).toMatchObject({ steps: [], instructions: '' });
  });

  it('fills an inhaler as one unit and leaves a cream’s quantity empty', () => {
    const albuterol = { name: 'Albuterol', strengths: [{ strength: '90 mcg/puff MDI', ndcs: ['00054074287'] }] };
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
        medication: { ndc: '00093117401', description: 'Penicillin V Potassium 500 MG Oral Tablet' },
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
  it('round-trips a line, leaving the diagnosis behind', () => {
    const line = { ...complete(), substitutionAllowed: false };
    const quickPick = prescriptionLineToQuickPick(line, '  Amoxicillin 10 days  ');
    expect(quickPick.name).toBe('Amoxicillin 10 days');
    expect(quickPick).not.toHaveProperty('diagnosis');

    const target = { ...emptyPrescriptionLine(), diagnosis: { code: 'R50.9', display: 'Fever, unspecified' } };
    const applied = applyPrescriptionQuickPick(target, { id: 'qp-1', ...quickPick });
    expect(applied).toEqual({
      ...line,
      key: target.key,
      diagnosis: target.diagnosis,
      quickPicked: { quantityValue: '20', daysSupply: '10', numberOfRefills: '0', noteToPharmacy: '' },
    });
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

  it('sets the suggestion’s diagnosis on the line; one without leaves the line’s', () => {
    const strep = { code: 'J02.0', display: 'Streptococcal pharyngitis' };
    expect(withSuggestion(liquid, fields, { diagnosis: strep }).diagnosis).toEqual(strep);
    const fever = { code: 'R50.9', display: 'Fever, unspecified' };
    expect(withSuggestion({ ...liquid, diagnosis: fever }, fields, { diagnosis: strep }).diagnosis).toEqual(strep);
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
    expect(withProduct(liquid(2, '5'), AMOXICILLIN, { strength: '500 mg Tab', ndcs: ['00093226301'] }).dose).toBe('1');
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
