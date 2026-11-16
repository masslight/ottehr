import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { PrescriptionOrderMetadata } from 'utils/lib/types/api/erx.types';
import { describe, expect, it } from 'vitest';
import {
  applyPrescriptionQuickPick,
  directionsFromBlanks,
  emptyPrescriptionLine,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import {
  approvalMetadata,
  changeApproval,
  changeResponse,
  refillLine,
  renewalApproval,
  requestRows,
  strengthChangeWarning,
  suggestionText,
} from '../../src/features/visits/in-person/components/erx/refillRequest';

const ORIGINAL: PrescribedMedicationDTO = {
  resourceId: 'rx-1',
  name: 'Lisinopril 10 mg tablet',
  instructions: 'Take 1 tablet by mouth once daily',
  sent: '2026-09-14T15:00:00.000Z',
  order: {
    ndc: '00093111101',
    medicationDescription: 'Lisinopril 10 mg tablet',
    quantityValue: 30,
    quantityUnit: 'Tablet',
    daysSupply: 30,
    numberOfRefills: 1,
    substitutionAllowed: true,
    noteToPharmacy: 'Call when ready',
    diagnosisCode: 'I10',
    diagnosisDescription: 'Essential hypertension',
  },
};

const row = (rows: ReturnType<typeof requestRows>, label: string): ReturnType<typeof requestRows>[number] =>
  rows.find((item) => item.label === label)!;

describe('refill request: what the pharmacy sent', () => {
  it('shows numbers in plain form', () => {
    const rows = requestRows(
      { quantityValue: Number('.27'), quantityUnit: 'Milliliter', daysSupply: Number('3.00'), requestedRefills: 0 },
      ORIGINAL
    );
    expect(row(rows, 'Quantity').request).toBe('0.27 milliliters');
    expect(row(rows, 'Days supply').request).toBe('3');
    expect(row(rows, 'Refills').request).toBe('0');
  });

  it('leaves a field the pharmacy left out empty: never 0, never the original’s (S.207)', () => {
    const rows = requestRows(
      { description: 'Lisinopril 10 mg tablet', ndc: '00093111101', quantityValue: 0.27, quantityUnit: 'Milliliter' },
      ORIGINAL
    );
    expect(row(rows, 'Days supply')).toEqual({
      label: 'Days supply',
      request: undefined,
      original: '30',
      differs: false,
    });
    expect(row(rows, 'Refills').request).toBeUndefined();
    expect(row(rows, 'Directions').request).toBeUndefined();
    expect(row(rows, 'Pharmacy note').request).toBeUndefined();
    expect(row(rows, 'Quantity')).toMatchObject({ request: '0.27 milliliters', original: '30 tablets', differs: true });
  });

  it('highlights what differs from the original; the medication by NDC, refills never', () => {
    const rows = requestRows(
      {
        description: 'LISINOPRIL 10MG TAB',
        ndc: '00093111101',
        quantityValue: 30,
        quantityUnit: 'Tablet',
        sig: 'Take 1 tablet by mouth twice daily',
        requestedRefills: 3,
        substitutionAllowed: true,
      },
      ORIGINAL
    );
    expect(row(rows, 'Medication').differs).toBe(false);
    expect(row(rows, 'Quantity').differs).toBe(false);
    expect(row(rows, 'Directions').differs).toBe(true);
    expect(row(rows, 'Refills')).toMatchObject({ request: '3', original: '1', differs: false });
    expect(row(rows, 'Substitution').differs).toBe(false);
  });

  // Review D5-4: directions that differ only in case, spacing or how a half is written read the same, as `sameSig`.
  it('marks directions only when they read differently, not for case, spacing or a half', () => {
    for (const sig of [
      'TAKE 1 TABLET BY MOUTH ONCE DAILY',
      'Take 1 tablet  by mouth once daily ',
      'take 1 tablet by mouth once daily',
    ]) {
      expect(row(requestRows({ sig }, ORIGINAL), 'Directions')).toMatchObject({ request: sig, differs: false });
    }
    expect(
      row(
        requestRows(
          { sig: 'TAKE 1/2 TABLET BY MOUTH ONCE DAILY' },
          { ...ORIGINAL, instructions: 'Take half tablet by mouth once daily' }
        ),
        'Directions'
      ).differs
    ).toBe(false);
    expect(row(requestRows({ sig: 'TAKE 2 TABLETS BY MOUTH ONCE DAILY' }, ORIGINAL), 'Directions').differs).toBe(true);
  });

  it('compares a quantity sent with no unit by its value, shown as sent', () => {
    expect(row(requestRows({ quantityValue: 30 }, ORIGINAL), 'Quantity')).toMatchObject({
      request: '30',
      original: '30 tablets',
      differs: false,
    });
    expect(row(requestRows({ quantityValue: 16 }, ORIGINAL), 'Quantity')).toMatchObject({
      request: '16',
      differs: true,
    });
  });

  it('highlights the medication only when its name reads differently, never for its NDC alone', () => {
    const sameName = requestRows({ description: 'Lisinopril 10 mg tablet', ndc: '00093111199' }, ORIGINAL);
    expect(row(sameName, 'Medication').differs).toBe(false);
    const otherName = requestRows({ description: 'Lisinopril 20 mg tablet', ndc: '00093111201' }, ORIGINAL);
    expect(row(otherName, 'Medication').differs).toBe(true);
  });
});

describe('refill request: the prescription the order form starts with', () => {
  it('takes what the pharmacy sent, else the original’s, and the original’s diagnosis', () => {
    const line = refillLine(ORIGINAL, {
      description: 'Lisinopril 20 mg tablet',
      ndc: '00093111201',
      quantityValue: 90,
      quantityUnit: 'Tablet',
      sig: 'Take 1 tablet by mouth once daily',
      requestedRefills: 3,
    });
    expect(line.medication).toEqual({ ndc: '00093111201', description: 'Lisinopril 20 mg tablet' });
    expect(line.quantityValue).toBe('90');
    // Not sent by the pharmacy: the original's, but never its note for another product.
    expect(line.daysSupply).toBe('30');
    expect(line.noteToPharmacy).toBe('');
    // 3 fills: the first and 2 refills.
    expect(line.numberOfRefills).toBe('2');
    expect(line.diagnosis).toEqual({ code: 'I10', display: 'Essential hypertension' });
  });

  it('takes the quantity unit only from the request, else leaves it empty', () => {
    expect(refillLine(ORIGINAL, { quantityValue: 0.27, quantityUnit: 'Milliliter' }).quantityUnit).toBe('Milliliter');
    const line = refillLine(ORIGINAL, { description: 'Lisinopril 20 mg tablet', quantityValue: 90 });
    expect(line.quantityValue).toBe('90');
    expect(line.quantityUnit).toBe('');
    expect(refillLine(ORIGINAL).quantityUnit).toBe('Tablet');
  });

  it('is the original prescription for a patient’s request', () => {
    const line = refillLine(ORIGINAL);
    expect(line.medication?.ndc).toBe('00093111101');
    expect(line.patientInstructions).toBe('Take 1 tablet by mouth once daily');
    expect(line.numberOfRefills).toBe('1');
    expect(line.substitutionAllowed).toBe(true);
  });

  it('answers with the line as the approval: fills are its refills plus the first fill', () => {
    expect(renewalApproval('renewal-1', refillLine(ORIGINAL))).toEqual({
      taskId: 'renewal-1',
      decision: 'approve',
      numberOfRefills: 2,
      changes: {
        medicationDescription: 'Lisinopril 10 mg tablet',
        ndc: '00093111101',
        quantityValue: 30,
        quantityUnit: 'Tablet',
        daysSupply: 30,
        substitutionAllowed: true,
        patientInstructions: 'Take 1 tablet by mouth once daily',
        noteToPharmacy: 'Call when ready',
      },
    });
  });
});

const OMEPRAZOLE = {
  description: 'Omeprazole 40 mg delayed-release capsule',
  ndc: '00093521998',
  quantityValue: 30,
  quantityUnit: 'Capsule',
  daysSupply: 30,
  numberOfRefills: 2,
  sig: 'Take 1 capsule by mouth once daily before breakfast',
};

describe('change request: the pharmacy’s suggestions', () => {
  it('says only what the pharmacy sent, numbers in plain form (S.207)', () => {
    expect(suggestionText(OMEPRAZOLE)).toBe(
      '30 capsules · Take 1 capsule by mouth once daily before breakfast · 30 days · 2 refills'
    );
    expect(
      suggestionText({ description: 'Pantoprazole 40 mg tablet', quantityValue: Number('.5'), daysSupply: 3 })
    ).toBe('0.5 · 3 days');
    expect(suggestionText({ description: 'Pantoprazole 40 mg tablet' })).toBe('');
    expect(suggestionText({ description: 'Pantoprazole 40 mg tablet', numberOfRefills: 0 })).toBe('0 refills');
  });

  it('compares a suggestion’s refills with the original’s, and leaves out what it didn’t send', () => {
    const rows = requestRows({ description: 'Pantoprazole 40 mg tablet', numberOfRefills: 2 }, ORIGINAL);
    expect(row(rows, 'Refills')).toEqual({ label: 'Refills', request: '2', original: '1', differs: true });
    expect(row(rows, 'Quantity').request).toBeUndefined();
    expect(row(rows, 'Days supply').request).toBeUndefined();
  });

  it('fills the order form from the suggestion, never with the original’s product', () => {
    const line = refillLine(ORIGINAL, { description: 'Pantoprazole 40 mg tablet', numberOfRefills: 0 });
    expect(line.medication?.ndc).toBeUndefined();
    expect(line.numberOfRefills).toBe('0');
    expect(refillLine(ORIGINAL, OMEPRAZOLE).medication?.ndc).toBe('00093521998');
  });

  it('never fills another product with the original’s directions, quantity or note to pharmacy', () => {
    const empty = { patientInstructions: '', quantityValue: '', noteToPharmacy: '' };
    expect(refillLine(ORIGINAL, { description: 'Pantoprazole 40 mg tablet', ndc: '00008084181' })).toMatchObject({
      ...empty,
      daysSupply: '30',
      diagnosis: { code: 'I10' },
    });
    expect(refillLine(ORIGINAL, { description: 'Pantoprazole 40 mg tablet' })).toMatchObject(empty);
    expect(
      refillLine(ORIGINAL, {
        description: 'Pantoprazole 40 mg tablet',
        ndc: '00008084181',
        sig: 'Take 1 tablet by mouth once daily',
        quantityValue: 30,
      })
    ).toMatchObject({
      patientInstructions: 'Take 1 tablet by mouth once daily',
      quantityValue: '30',
      noteToPharmacy: '',
    });
    // The same product, by NDC or by name, still falls back to the original's.
    const same = { patientInstructions: ORIGINAL.instructions, quantityValue: '30', noteToPharmacy: 'Call when ready' };
    expect(refillLine(ORIGINAL, { description: 'LISINOPRIL 10MG TAB', ndc: '00093111101' })).toMatchObject(same);
    expect(refillLine(ORIGINAL, { description: 'lisinopril 10 mg tablet' })).toMatchObject(same);
  });
});

describe('change request: the answers', () => {
  it('approves the selected suggestion as sent, by its position', () => {
    expect(changeResponse('change-1', 'approve', { suggestion: 1, note: 'OK' })).toEqual({
      taskId: 'change-1',
      decision: 'approve',
      requestedMedicationIndex: 1,
      note: 'OK',
    });
  });

  // The eRx service refuses this answer today (review R63): this only pins what is sent.
  it('answers Approve to a drug-use alert with no suggestion or changes', () => {
    const response = changeResponse('change-1', 'approve', { note: 'Monitor' });
    expect(response).toStrictEqual({ taskId: 'change-1', decision: 'approve', note: 'Monitor' });
  });

  it('approves a prior authorization request with its number, never a suggestion or changes', () => {
    expect(changeResponse('change-1', 'approve', { priorAuthorization: 'PA-88431207' })).toEqual({
      taskId: 'change-1',
      decision: 'approve',
      priorAuthorization: { number: 'PA-88431207', status: 'approved' },
    });
  });

  it('denies or answers pending with a reason and an optional note', () => {
    expect(changeResponse('change-1', 'deny', { reason: 'Change not appropriate', note: 'Keep Dexilant' })).toEqual({
      taskId: 'change-1',
      decision: 'deny',
      reason: 'Change not appropriate',
      denialReason: 'Keep Dexilant',
    });
    expect(changeResponse('change-1', 'pending', { reason: 'Patient has labs/tests pending' })).toEqual({
      taskId: 'change-1',
      decision: 'pending',
      reason: 'Patient has labs/tests pending',
    });
  });

  it('sends the patient’s allergies with every answer, and none when there are none', () => {
    const allergies = [{ name: 'Penicillins', adverseEvent: 'Allergy to substance', source: 'Clinician' }] as const;
    const given = { allergies: [...allergies] };
    expect(changeResponse('change-1', 'approve', { suggestion: 0, ...given })).toMatchObject({ allergies });
    expect(changeResponse('change-1', 'deny', { reason: 'Change not appropriate', ...given })).toMatchObject({
      allergies,
    });
    expect(changeResponse('change-1', 'pending', { reason: 'Patient has labs/tests pending', ...given })).toMatchObject(
      { allergies }
    );
    expect(changeResponse('change-1', 'deny', { reason: 'Change not appropriate' })).not.toHaveProperty('allergies');
    expect(changeApproval('change-1', undefined, refillLine(ORIGINAL), undefined, [...allergies])).toMatchObject({
      allergies,
    });
    expect(renewalApproval('renewal-1', refillLine(ORIGINAL), undefined, [...allergies])).toMatchObject({ allergies });
    expect(renewalApproval('renewal-1', refillLine(ORIGINAL))).not.toHaveProperty('allergies');
  });

  it('“Change” sends the whole prescription over the selected suggestion, refills as written', () => {
    const line = refillLine(ORIGINAL, OMEPRAZOLE);
    expect(changeApproval('change-1', 0, line)).toEqual({
      taskId: 'change-1',
      decision: 'approve',
      requestedMedicationIndex: 0,
      changes: {
        medicationDescription: 'Omeprazole 40 mg delayed-release capsule',
        ndc: '00093521998',
        quantityValue: 30,
        quantityUnit: 'Capsule',
        daysSupply: 30,
        substitutionAllowed: true,
        patientInstructions: 'Take 1 capsule by mouth once daily before breakfast',
        numberOfRefills: 2,
      },
    });
    // No suggestions (a clarification): the changes are over the original.
    expect(changeApproval('change-1', undefined, refillLine(ORIGINAL)).requestedMedicationIndex).toBeUndefined();
  });
});

describe('refill request: the original’s blanks fill the order form again', () => {
  const METADATA: PrescriptionOrderMetadata = {
    version: 1,
    product: {
      doseForm: 'Oral Tablet',
      ingredients: [{ name: 'lisinopril', amount: 10, unit: 'MG', per: 1, perUnit: 'EACH' }],
    },
    route: 'by mouth',
    dose: '1',
    frequency: 'once daily',
    durationDays: '30',
  };

  it('fills the blanks for the original’s product and keeps its directions as sent', () => {
    const line = refillLine(ORIGINAL, undefined, METADATA);
    expect(line).toMatchObject({
      route: 'by mouth',
      dose: '1',
      frequency: 'once daily',
      durationDays: '30',
      // The sig as sent, though the blanks write "... for 30 days.": typed over them.
      patientInstructions: 'Take 1 tablet by mouth once daily',
      quantityValue: '30',
      daysSupply: '30',
      numberOfRefills: '1',
    });
    expect(line.medication).toEqual({
      ndc: '00093111101',
      description: 'Lisinopril 10 mg tablet',
      ...METADATA.product,
    });
    // The pharmacy asking for the same product, with its own quantity.
    expect(
      refillLine(
        ORIGINAL,
        { ndc: '00093111101', quantityValue: 90, quantityUnit: 'Tablet', requestedRefills: 3 },
        METADATA
      )
    ).toMatchObject({ dose: '1', frequency: 'once daily', quantityValue: '90', numberOfRefills: '2' });
  });

  it('follows the blanks when they write the directions as sent, and keeps a typed note when they don’t', () => {
    const asWritten = { ...ORIGINAL, instructions: 'Take 1 tablet by mouth once daily for 30 days.' };
    const line = refillLine(asWritten, undefined, METADATA);
    expect(line.patientInstructions).toBe('Take 1 tablet by mouth once daily for 30 days.');
    expect(directionsFromBlanks(line)).toBe(true);
    const noted = { ...ORIGINAL, instructions: 'Take 1 tablet by mouth once daily for 30 days. Typed note.' };
    expect(refillLine(noted, undefined, METADATA)).toMatchObject({
      dose: '1',
      frequency: 'once daily',
      patientInstructions: 'Take 1 tablet by mouth once daily for 30 days. Typed note.',
    });
  });

  it('fills them when the pharmacy sent our directions back, in any case and spacing', () => {
    const line = refillLine(ORIGINAL, { ndc: '00093111101', sig: 'TAKE 1 TABLET  BY MOUTH ONCE DAILY ' }, METADATA);
    expect(line).toMatchObject({
      dose: '1',
      route: 'by mouth',
      frequency: 'once daily',
      // Ours as sent, not the pharmacy's copy.
      patientInstructions: 'Take 1 tablet by mouth once daily',
    });
    // "½" on screen, "half" as sent, and "1/2" as an older prescription went: all the same directions.
    const half = { ...ORIGINAL, instructions: 'Take ½ tablet by mouth once daily' };
    expect(refillLine(half, { ndc: '00093111101', sig: 'Take 1/2 tablet by mouth once daily' }, METADATA).dose).toBe(
      '1'
    );
    expect(refillLine(half, { ndc: '00093111101', sig: 'Take half tablet by mouth once daily' }, METADATA).dose).toBe(
      '1'
    );
    const older = { ...ORIGINAL, instructions: 'Take 1 1/2 tablets by mouth once daily' };
    expect(
      refillLine(older, { ndc: '00093111101', sig: 'Take 1 and a half tablets by mouth once daily' }, METADATA).dose
    ).toBe('1');
  });

  it('keeps the pharmacy’s own directions as its text, with the blanks empty', () => {
    const line = refillLine(ORIGINAL, { ndc: '00093111101', sig: 'Take 1 tablet by mouth twice daily' }, METADATA);
    expect(line).toMatchObject({
      dose: '',
      route: '',
      frequency: '',
      durationDays: '',
      patientInstructions: 'Take 1 tablet by mouth twice daily',
    });
    expect(line.medication).toEqual({ ndc: '00093111101', description: 'Lisinopril 10 mg tablet' });
  });

  it('starts from the sig alone without them, or when the request names another product or none', () => {
    const asBefore = { dose: '', route: '', frequency: '', durationDays: '' };
    expect(refillLine(ORIGINAL)).toMatchObject({
      ...asBefore,
      patientInstructions: 'Take 1 tablet by mouth once daily',
    });
    expect(
      refillLine(
        ORIGINAL,
        { description: 'Lisinopril 20 mg tablet', ndc: '00093111201', sig: 'Take 1 tablet by mouth once daily' },
        METADATA
      )
    ).toMatchObject({ ...asBefore, patientInstructions: 'Take 1 tablet by mouth once daily' });
    expect(refillLine(ORIGINAL, { description: 'Lisinopril 10 mg tablet' }, METADATA)).toMatchObject(asBefore);
  });

  it('keeps the blanks on the approved prescription, also under typed directions, as a new order does', () => {
    const filled = refillLine(
      ORIGINAL,
      { ndc: '00093111101', quantityValue: 90, quantityUnit: 'Tablet', requestedRefills: 3 },
      METADATA
    );
    expect(renewalApproval('renewal-1', filled).metadata).toEqual(METADATA);
    expect(changeApproval('change-1', 0, filled).metadata).toEqual(METADATA);
    expect(approvalMetadata(filled)).toEqual(METADATA);
    // Typed over: still the blanks. The pharmacy's own directions: none.
    const typed = { ...filled, patientInstructions: `${filled.patientInstructions} With water.` };
    expect(renewalApproval('renewal-1', typed).metadata).toEqual(METADATA);
    expect(changeApproval('change-1', 0, typed).metadata).toEqual(METADATA);
    expect(approvalMetadata(typed)).toEqual(METADATA);
    expect(
      approvalMetadata(refillLine(ORIGINAL, { ndc: '00093111101', sig: 'Take 1 tablet twice daily' }, METADATA))
    ).toBeUndefined();
    expect(approvalMetadata(refillLine(ORIGINAL))).toBeUndefined();
  });

  it('never keeps blanks for a compound', () => {
    const compound = applyPrescriptionQuickPick(emptyPrescriptionLine(), {
      id: 'qp-cream',
      name: 'Pain cream',
      compound: {
        description: 'Ketoprofen cream',
        dosageForm: 'Cream',
        ingredients: [{ description: 'Ketoprofen Powder', ndc: '00000000001', strength: { value: 10, unit: '%' } }],
      },
      quantityValue: 60,
      quantityUnit: 'Gram',
      patientInstructions: 'Apply twice daily.',
    });
    expect(approvalMetadata(compound)).toBeUndefined();
    const approval = renewalApproval('renewal-1', compound);
    expect(approval).not.toHaveProperty('metadata');
    // Either an NDC or a compound in the changes, never both.
    expect(approval.changes?.compound).toEqual({
      dosageForm: 'Cream',
      ingredients: [
        {
          description: 'Ketoprofen Powder',
          ndc: '00000000001',
          strength: { value: '10', unit: 'Percentage' },
          quantityValue: 6,
          quantityUnit: 'Gram',
        },
      ],
    });
    expect(approval.changes).not.toHaveProperty('ndc');
  });

  it('fills the order form with a suggested compound and approves with it, and the vitals given', () => {
    const suggestion = {
      description: 'Pain cream',
      compound: {
        description: 'Pain cream',
        dosageForm: 'Cream',
        ingredients: [
          { description: 'Ketoprofen Powder', ndc: '00000000001', amount: { value: 6, unit: 'Gram' as const } },
        ],
      },
      quantityValue: 60,
      quantityUnit: 'Gram',
      sig: 'Apply twice daily.',
    };
    const line = refillLine(ORIGINAL, suggestion);
    expect(line.medication).toBeFalsy();
    expect(line.compound?.name).toBe('Pain cream');
    const vitals = { weight: { value: 70.5, unit: 'kg', measuredDate: '2026-11-11' } } as const;
    const approval = changeApproval('change-1', 0, line, vitals);
    expect(approval).toMatchObject({
      requestedMedicationIndex: 0,
      vitals,
      changes: {
        compound: {
          dosageForm: 'Cream',
          ingredients: [
            { description: 'Ketoprofen Powder', ndc: '00000000001', quantityValue: 6, quantityUnit: 'Gram' },
          ],
        },
      },
    });
    expect(approval.changes).not.toHaveProperty('ndc');
    // A product approval has its NDC and no compound; no vitals, none sent.
    const product = changeApproval('change-1', undefined, refillLine(ORIGINAL));
    expect(product.changes).toMatchObject({ ndc: '00093111101' });
    expect(product.changes).not.toHaveProperty('compound');
    expect(product).not.toHaveProperty('vitals');
  });

  it('“Change” on a compound as the pharmacy sent it sends back exactly what it sent, strengths included', () => {
    // As the eRx service keeps it on the renewal Task.
    const sent = {
      dosageForm: 'Cream' as const,
      ingredients: [
        {
          description: 'Ketoprofen Powder',
          ndc: '38779032709',
          strength: { value: '10', form: 'Percentage' },
          quantityValue: 3,
          quantityUnit: 'Gram' as const,
        },
        {
          description: 'Lidocaine',
          ndc: '00000000002',
          strength: { value: '5', unit: 'mg/ml' },
          quantityValue: 1500,
          quantityUnit: 'Milligram' as const,
        },
        { description: 'Cream base', quantityValue: 25.5, quantityUnit: 'Gram' as const },
      ],
    };
    // As the dialog reads it (readPharmacyRefillRequest).
    const compound = {
      description: 'Pain cream',
      dosageForm: sent.dosageForm,
      ingredients: sent.ingredients.map(({ description, ndc, strength, quantityValue, quantityUnit }) => ({
        description,
        ...(ndc ? { ndc } : {}),
        ...(strength ? { sentStrength: strength } : {}),
        amount: { value: quantityValue, unit: quantityUnit },
      })),
    };
    const line = refillLine(ORIGINAL, {
      description: 'Pain cream',
      compound,
      quantityValue: 30,
      quantityUnit: 'Gram',
      sig: 'Apply twice daily.',
      requestedRefills: 2,
    });
    expect(renewalApproval('renewal-1', line).changes?.compound).toEqual(sent);
  });

  it('shows a compound as the prescriptions table does, and it differs from a product', () => {
    const rows = requestRows(
      {
        description: 'Pain cream',
        compound: {
          description: 'Pain cream',
          dosageForm: 'Cream',
          ingredients: [{ description: 'Ketoprofen Powder', amount: { value: 6, unit: 'Gram' } }],
        },
      },
      ORIGINAL
    );
    expect(row(rows, 'Medication')).toMatchObject({
      request: 'Compound: Pain cream · Cream · Ketoprofen Powder 6 grams',
      original: 'Lisinopril 10 mg tablet',
      differs: true,
    });
  });

  it('sends the blanks given with a plain approval only, never with a denial or pending answer', () => {
    expect(changeResponse('change-1', 'approve', { suggestion: 0, metadata: METADATA })).toEqual({
      taskId: 'change-1',
      decision: 'approve',
      requestedMedicationIndex: 0,
      metadata: METADATA,
    });
    expect(changeResponse('change-1', 'approve', { priorAuthorization: 'PA-1', metadata: METADATA })).toMatchObject({
      metadata: METADATA,
    });
    expect(
      changeResponse('change-1', 'deny', { reason: 'Change not appropriate', metadata: METADATA })
    ).not.toHaveProperty('metadata');
    expect(
      changeResponse('change-1', 'pending', { reason: 'Patient has labs/tests pending', metadata: METADATA })
    ).not.toHaveProperty('metadata');
  });
});

// Review D2-2: the same amount of another strength is another dose, whatever words the pharmacy's sig uses; the same
// strength from another maker or bottle (another NDC) isn't.
describe('change request: a suggestion of another strength with the same directions', () => {
  const AMOXICILLIN: PrescribedMedicationDTO = {
    resourceId: 'rx-2',
    name: 'Amoxicillin 400 mg/5ml Susp',
    instructions: 'Take 5 mL by mouth twice daily for 10 days.',
    order: { ndc: '00093415573', medicationDescription: 'Amoxicillin 400 mg/5ml Susp' },
  };

  it('names both strengths when the pharmacy rewords the same amount', () => {
    expect(
      strengthChangeWarning(
        {
          description: 'Amoxicillin 250 mg/5ml Susp',
          ndc: '00093415273',
          sig: 'Take 5 ml by mouth 2 times a day for 10 days',
        },
        AMOXICILLIN
      )
    ).toBe('Different strength, same amount: 400 mg/5 mL → 250 mg/5 mL. Check the dose.');
    expect(
      strengthChangeWarning(
        { description: 'Lisinopril 20 mg tablet', ndc: '00093111201', sig: 'TAKE 1 TABLET BY MOUTH ONCE DAILY' },
        ORIGINAL
      )
    ).toBe('Different strength, same amount: 10 mg → 20 mg. Check the dose.');
  });

  // Review D4-1: pharmacy directions in upper case read the same amount, a half included.
  it('warns on a half tablet in upper case', () => {
    const prednisone: PrescribedMedicationDTO = {
      resourceId: 'rx-5',
      name: 'Prednisone 10 mg tablet',
      instructions: 'Take half tablet by mouth daily',
      order: { ndc: '00054474025', medicationDescription: 'Prednisone 10 mg tablet' },
    };
    const twenty = { description: 'Prednisone 20 mg tablet', ndc: '00054474125' };
    const warning = 'Different strength, same amount: 10 mg → 20 mg. Check the dose.';
    expect(strengthChangeWarning({ ...twenty, sig: 'TAKE 1/2 TABLET BY MOUTH DAILY' }, prednisone)).toBe(warning);
    expect(
      strengthChangeWarning(
        { ...twenty, sig: 'TAKE 1 1/2 TABLETS BY MOUTH DAILY' },
        { ...prednisone, instructions: 'Take 1 and a half tablets by mouth daily' }
      )
    ).toBe(warning);
    // Item 120: "tab" and "tabs" read as "tablet".
    expect(strengthChangeWarning({ ...twenty, sig: 'TAKE 1/2 TAB BY MOUTH DAILY' }, prednisone)).toBe(warning);
    expect(
      strengthChangeWarning(
        { ...twenty, sig: 'TAKE 2 TABS BY MOUTH DAILY' },
        { ...prednisone, instructions: 'Take 2 tablets by mouth daily' }
      )
    ).toBe(warning);
    expect(
      strengthChangeWarning(
        { ...twenty, sig: 'Take 1 tab by mouth daily' },
        { ...prednisone, instructions: 'Take 1 tablet' }
      )
    ).toBe(warning);
    // "tablespoon" isn't a tablet.
    expect(
      strengthChangeWarning(
        { ...twenty, sig: 'Take 1 tablespoon daily' },
        { ...prednisone, instructions: 'Take 1 tablet' }
      )
    ).toBeUndefined();
  });

  it('says nothing for the same strength from another maker or bottle', () => {
    expect(
      strengthChangeWarning(
        {
          description: 'Amoxicillin 400 mg/5ml Susp',
          ndc: '65862007010',
          sig: 'Take 5 mL by mouth twice daily for 10 days.',
        },
        AMOXICILLIN
      )
    ).toBeUndefined();
    expect(
      strengthChangeWarning(
        { description: 'Amoxicillin 80 mg/mL Susp', ndc: '65862007011', sig: 'Take 5 mL by mouth twice daily' },
        AMOXICILLIN
      )
    ).toBeUndefined();
  });

  // Review D3-1: mg of one drug can't be weighed against mg of another, so the warning is for the same ingredient only.
  it('warns for another product with the same ingredient, and says nothing for another drug', () => {
    expect(
      strengthChangeWarning(
        {
          description: 'Amoxicillin-Pot Clavulanate 600-42.9 mg/5ml Susp',
          ndc: '00093227573',
          sig: 'Take 5 mL by mouth twice daily for 10 days',
        },
        AMOXICILLIN
      )
    ).toBe('Different strength, same amount: 400 mg/5 mL → 600-42.9 mg/5 mL. Check the dose.');
    expect(
      strengthChangeWarning(
        { description: 'Cefdinir 250 mg/5ml Susp', ndc: '00093416073', sig: 'Take 5 mL by mouth twice daily' },
        AMOXICILLIN
      )
    ).toBeUndefined();
    const original = (name: string, instructions: string): PrescribedMedicationDTO => ({
      resourceId: 'rx-3',
      name,
      instructions,
      order: { ndc: '00000000001', medicationDescription: name },
    });
    expect(
      strengthChangeWarning(
        { description: 'Omeprazole 40 mg Capsule DR', ndc: '00093521998', sig: 'Take 1 capsule by mouth daily' },
        original('Dexlansoprazole 60 mg Capsule DR', 'Take 1 capsule by mouth once daily.')
      )
    ).toBeUndefined();
    expect(
      strengthChangeWarning(
        { description: 'Levocetirizine 5 mg Tab', ndc: '00093111301', sig: 'Take 1 tablet by mouth once daily' },
        original('Cetirizine HCl 10 mg Tab', 'Take 1 tablet by mouth once daily.')
      )
    ).toBeUndefined();
    // A salt or form word isn't an ingredient: these share only "Sodium" and "Oral Suspension".
    expect(
      strengthChangeWarning(
        { description: 'Naproxen Sodium 125 mg/5ml Oral Suspension', ndc: '00093111401', sig: 'Take 5 mL by mouth' },
        original('Docusate Sodium 50 mg/5ml Oral Suspension', 'Take 5 mL by mouth.')
      )
    ).toBeUndefined();
  });

  // Review D4-2 and D4-3: "unit" and "units" are one unit, "100,000" is 100000, and a name's age-group or form words
  // ("Childrens", "Infants", "for") aren't a shared ingredient.
  it('says nothing for units written another way, or for another drug with the same label words', () => {
    const original = (name: string, instructions: string): PrescribedMedicationDTO => ({
      resourceId: 'rx-6',
      name,
      instructions,
      order: { ndc: '00000000001', medicationDescription: name },
    });
    const nystatin = original('Nystatin 100000 unit/mL Susp', 'Take 1 mL by mouth four times daily.');
    const nystatinSig = 'Take 1 mL by mouth four times daily';
    for (const description of ['Nystatin 100000 units/mL Susp', 'NYSTATIN 100,000 UNITS/ML SUSP']) {
      expect(strengthChangeWarning({ description, ndc: '00000000002', sig: nystatinSig }, nystatin)).toBeUndefined();
    }
    const swaps: [string, string, string][] = [
      ['Childrens Ibuprofen 100 mg/5ml Susp', 'Childrens Acetaminophen 160 mg/5ml Susp', 'Take 5 mL by mouth'],
      ["Children's Ibuprofen 100 mg/5ml Susp", "Children's Acetaminophen 160 mg/5ml Susp", 'Take 5 mL by mouth'],
      ['Infants Ibuprofen 50 mg/1.25ml Susp', "Infant's Acetaminophen 160 mg/5ml Susp", 'Take 1.25 mL by mouth'],
      ['Junior Ibuprofen 100 mg Chewable Tab', 'Junior Acetaminophen 160 mg Chewable Tab', 'Chew 1 tablet'],
      ['Adult Ibuprofen 200 mg Tab', 'Adult Acetaminophen 325 mg Tab', 'Take 1 tablet'],
      ['Cefdinir for Oral Suspension 250 mg/5ml', 'Amoxicillin for Oral Suspension 400 mg/5ml', 'Take 5 mL by mouth'],
    ];
    for (const [from, to, sig] of swaps) {
      expect(strengthChangeWarning({ description: to, ndc: '00000000003', sig }, original(from, sig))).toBeUndefined();
    }
    // The same ingredient for another age group is still another strength.
    expect(
      strengthChangeWarning(
        { description: 'Childrens Ibuprofen 100 mg/5ml Susp', ndc: '00000000004', sig: 'Take 1.25 mL by mouth' },
        original('Infants Ibuprofen 50 mg/1.25ml Susp', 'Take 1.25 mL by mouth')
      )
    ).toBe('Different strength, same amount: 50 mg/1.25 mL → 100 mg/5 mL. Check the dose.');
  });

  // Review D3-2: albuterol's "2.5 mg/3 mL", "0.83 mg/mL" and "0.083%" are the same solution (a liquid's % is g per
  // 100 mL, so ×10 mg/mL), and 2.5 ÷ 3 is 0.833: strengths within 2% are the same. Half the strength still warns.
  it('says nothing for the same strength written per 3 mL, per mL or as a percent', () => {
    const albuterol: PrescribedMedicationDTO = {
      resourceId: 'rx-4',
      name: 'Albuterol Sulfate (2.5 MG/3ML) 0.083% Nebu Soln',
      instructions: 'Inhale 3 mL by nebulizer every 4 hours as needed.',
      order: { ndc: '00487950101', medicationDescription: 'Albuterol Sulfate (2.5 MG/3ML) 0.083% Nebu Soln' },
    };
    const sig = 'Inhale 3 mL via nebulizer every 4 hours as needed';
    for (const description of ['albuterol 0.83 MG/ML Inhalation Solution', 'ALBUTEROL SULFATE 0.083% NEB SOLN']) {
      expect(strengthChangeWarning({ description, ndc: '00487950102', sig }, albuterol)).toBeUndefined();
    }
    expect(
      strengthChangeWarning(
        { description: 'Albuterol Sulfate (1.25 MG/3ML) 0.042% Nebu Soln', ndc: '00487950103', sig },
        albuterol
      )
    ).toBe('Different strength, same amount: 2.5 mg/3 mL → 1.25 mg/3 mL. Check the dose.');
  });

  // Review D5-3: RxNorm writes a combination per ingredient ("875 MG / 125 MG"), the same as "875-125 mg".
  it('reads a strength written per ingredient as the combination', () => {
    const original = (name: string, instructions: string): PrescribedMedicationDTO => ({
      resourceId: 'rx-7',
      name,
      instructions,
      order: { ndc: '00000000001', medicationDescription: name },
    });
    const tablet = original('Amoxicillin-Pot Clavulanate 875-125 mg Tab', 'Take 1 tablet by mouth twice daily');
    const liquid = original('Amoxicillin-Pot Clavulanate 400-57 mg/5ml Susp', 'Take 5 mL by mouth twice daily');
    expect(
      strengthChangeWarning(
        {
          description: 'amoxicillin 875 MG / clavulanate potassium 125 MG Oral Tablet',
          ndc: '00000000002',
          sig: 'Take 1 tablet by mouth twice daily',
        },
        tablet
      )
    ).toBeUndefined();
    expect(
      strengthChangeWarning(
        {
          description: 'amoxicillin 80 MG/ML / clavulanate potassium 11.4 MG/ML Oral Suspension',
          ndc: '00000000003',
          sig: 'Take 5 mL by mouth twice daily',
        },
        liquid
      )
    ).toBeUndefined();
    // Another strength written so still warns, with its amounts together.
    expect(
      strengthChangeWarning(
        {
          description: 'amoxicillin 500 MG / clavulanate potassium 125 MG Oral Tablet',
          ndc: '00000000004',
          sig: 'Take 1 tablet by mouth twice daily',
        },
        tablet
      )
    ).toBe('Different strength, same amount: 875-125 mg → 500-125 mg. Check the dose.');
  });

  it('says nothing when the amount differs, or the pharmacy sent no directions', () => {
    expect(
      strengthChangeWarning(
        { description: 'Amoxicillin 250 mg/5ml Susp', ndc: '00093415273', sig: 'Take 8 mL by mouth twice daily' },
        AMOXICILLIN
      )
    ).toBeUndefined();
    expect(
      strengthChangeWarning({ description: 'Amoxicillin 250 mg/5ml Susp', ndc: '00093415273' }, AMOXICILLIN)
    ).toBeUndefined();
  });
});
