import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it } from 'vitest';
import {
  changeApproval,
  changeResponse,
  refillLine,
  renewalApproval,
  requestRows,
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
    // Not sent by the pharmacy: the original's.
    expect(line.daysSupply).toBe('30');
    expect(line.noteToPharmacy).toBe('Call when ready');
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

  it('approves a drug-use alert with no suggestion as written: no suggestion, no changes', () => {
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

  it('“Change and approve” sends the whole prescription over the selected suggestion, refills as written', () => {
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
        noteToPharmacy: 'Call when ready',
        numberOfRefills: 2,
      },
    });
    // No suggestions (a clarification): the changes are over the original.
    expect(changeApproval('change-1', undefined, refillLine(ORIGINAL)).requestedMedicationIndex).toBeUndefined();
  });
});
