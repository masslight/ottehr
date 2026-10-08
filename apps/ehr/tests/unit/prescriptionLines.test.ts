import { describe, expect, it } from 'vitest';
import {
  applyPrescriptionQuickPick,
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineErrors,
  prescriptionLineToOrder,
  prescriptionLineToQuickPick,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';

const complete = (): PrescriptionLine => ({
  ...emptyPrescriptionLine(),
  medication: { ndc: '00093310901', description: 'Amoxicillin 500 MG Oral Capsule' },
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

describe('prescriptionLineErrors', () => {
  it('names everything an empty line still needs, in sentence order', () => {
    expect(prescriptionLineErrors(emptyPrescriptionLine())).toEqual([
      'Pick a medication',
      'Quantity must be greater than 0',
      'Pick a unit',
      'Enter the directions',
      'Add a diagnosis',
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

describe('prescriptionLineToOrder', () => {
  it('builds one order with the shared pharmacy and written date', () => {
    expect(
      prescriptionLineToOrder(complete(), {
        patientId: 'patient-1',
        practitionerId: 'practitioner-1',
        encounterId: 'encounter-1',
        pharmacy: PHARMACY,
        writtenDate: '2026-10-07',
      })
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
});

describe('prescription quick picks', () => {
  it('round-trips a line, leaving the diagnosis behind', () => {
    const line = { ...complete(), substitutionAllowed: false };
    const quickPick = prescriptionLineToQuickPick(line, '  Amoxicillin 10 days  ');
    expect(quickPick.name).toBe('Amoxicillin 10 days');
    expect(quickPick).not.toHaveProperty('diagnosis');

    const target = { ...emptyPrescriptionLine(), diagnosis: { code: 'R50.9', display: 'Fever, unspecified' } };
    const applied = applyPrescriptionQuickPick(target, { id: 'qp-1', ...quickPick });
    expect(applied).toEqual({ ...line, key: target.key, diagnosis: target.diagnosis });
  });
});
