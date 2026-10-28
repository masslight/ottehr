import { MedicationRequest } from 'fhir/r4b';
import { PRESCRIPTION_ERX_PHARMACY_ID_URL } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { makePrescribedMedicationDTO } from '../../src/shared/chart-data';

const makeMedicationRequest = (overrides: Partial<MedicationRequest> = {}): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  id: 'med-request-1',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/patient-1' },
  encounter: { reference: 'Encounter/encounter-1' },
  meta: { lastUpdated: '2026-10-27T15:00:00.000Z' },
  ...overrides,
});

describe('makePrescribedMedicationDTO pharmacy id', () => {
  it('reads the string the eRx service writes', () => {
    const medicationRequest = makeMedicationRequest({
      extension: [{ url: PRESCRIPTION_ERX_PHARMACY_ID_URL, valueString: '0002026' }],
    });
    expect(makePrescribedMedicationDTO(medicationRequest).pharmacyId).toBe('0002026');
  });

  it('still reads an integer', () => {
    const medicationRequest = makeMedicationRequest({
      extension: [{ url: PRESCRIPTION_ERX_PHARMACY_ID_URL, valueInteger: 2026 }],
    });
    expect(makePrescribedMedicationDTO(medicationRequest).pharmacyId).toBe('2026');
  });
});
