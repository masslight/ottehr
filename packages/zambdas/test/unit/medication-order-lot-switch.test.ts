import { Medication, MedicationAdministration, Patient } from 'fhir/r4b';
import { getMedicationFromMA } from 'utils/lib/fhir/medication-administration';
import { IN_HOUSE_CONTAINED_MEDICATION_ID } from 'utils/lib/types/api/medication-administration.constants';
import {
  inHouseMedicationsMedicationApplianceRoutes,
  MedicationData,
} from 'utils/lib/types/api/medication-administration.types';
import { describe, expect, it } from 'vitest';
import {
  createMedicationCopy,
  updateMedicationAdministrationData,
} from '../../src/ehr/create-update-medication-order/helpers';

const savedOrder: MedicationAdministration = {
  resourceType: 'MedicationAdministration',
  id: 'ma-1',
  status: 'completed',
  subject: { reference: 'Patient/p-1' },
  effectiveDateTime: '2026-11-10T10:00:00Z',
  medicationReference: { reference: `#${IN_HOUSE_CONTAINED_MEDICATION_ID}` },
  contained: [
    {
      resourceType: 'Medication',
      id: IN_HOUSE_CONTAINED_MEDICATION_ID,
      manufacturer: { display: 'Pfizer' },
      batch: { lotNumber: 'A123', expirationDate: '2027-11-10' },
    },
  ],
};

const resave = (orderData: Partial<MedicationData>): Medication | undefined => {
  const data = {
    patient: 'p-1',
    encounterId: 'enc-1',
    medicationId: IN_HOUSE_CONTAINED_MEDICATION_ID,
    route: inHouseMedicationsMedicationApplianceRoutes.ORAL.code,
    dose: 2,
    units: 'mg',
    lotNumber: 'B456',
    expDate: '2027-12-31',
    ...orderData,
  } as MedicationData;
  const saved = updateMedicationAdministrationData({
    orderData: data,
    orderResources: { medicationAdministration: savedOrder, patient: { resourceType: 'Patient' } as Patient },
    medicationResource: createMedicationCopy(getMedicationFromMA(savedOrder)!, data, 'administered'),
    newStatus: 'administered',
  });
  return getMedicationFromMA(saved);
};

describe('create-update-medication-order - manufacturer when the lot changes', () => {
  it('drops the previous manufacturer when the request clears it', () => {
    expect(resave({ manufacturer: '' })?.manufacturer).toBeUndefined();
  });

  it('keeps the saved manufacturer when the request leaves it out', () => {
    expect(resave({})?.manufacturer).toEqual({ display: 'Pfizer' });
  });
});
