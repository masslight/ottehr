import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it } from 'vitest';
import {
  refillLine,
  renewalApproval,
  requestRows,
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
