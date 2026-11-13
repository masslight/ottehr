import { Medication, MedicationAdministration, Patient } from 'fhir/r4b';
import {
  IN_HOUSE_CONTAINED_MEDICATION_ID,
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { ExtendedMedicationDataForResponse } from 'utils/lib/types/api/medication-administration.types';
import { describe, expect, it } from 'vitest';
import { createMedicationCopy } from '../../src/ehr/create-update-medication-order/helpers';
import { mapMedicalAdministrationToDTO } from '../../src/ehr/get-medication-orders/index';

const NAME = 'Ondansetron 4 mg/2 mL';

const catalogDrug = (id: string): Medication => ({
  resourceType: 'Medication',
  id,
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: NAME },
  ],
});

const readOrder = (copy: Medication): ExtendedMedicationDataForResponse => {
  const order: MedicationAdministration = {
    resourceType: 'MedicationAdministration',
    id: 'ma-1',
    status: 'in-progress',
    subject: { reference: 'Patient/p-1' },
    medicationReference: { reference: `#${IN_HOUSE_CONTAINED_MEDICATION_ID}` },
    contained: [{ ...copy, id: IN_HOUSE_CONTAINED_MEDICATION_ID }],
  };
  return mapMedicalAdministrationToDTO({
    medicationAdministration: order,
    patient: { resourceType: 'Patient' } as Patient,
  });
};

describe('get-medication-orders - the catalog drug of a saved order', () => {
  it('returns the catalog drug each order was made from when two catalog drugs share a name', () => {
    expect(readOrder(createMedicationCopy(catalogDrug('med-1'), {}))).toMatchObject({
      medicationName: NAME,
      catalogMedicationId: 'med-1',
    });
    expect(readOrder(createMedicationCopy(catalogDrug('med-2'), {}))).toMatchObject({
      medicationName: NAME,
      catalogMedicationId: 'med-2',
    });
  });

  it('returns none for an order whose copy does not record its catalog drug', () => {
    const legacyCopy: Medication = {
      resourceType: 'Medication',
      identifier: [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: NAME }],
    };
    expect(readOrder(legacyCopy).catalogMedicationId).toBeUndefined();
  });

  it('returns the inventory lot selected for the order, and none for a typed lot', () => {
    const lot = { lotNumber: 'A123', expDate: '2027-03-31' };
    expect(readOrder(createMedicationCopy(catalogDrug('med-1'), { ...lot, inventoryLotId: 'lot-1' }))).toMatchObject({
      lotNumber: 'A123',
      inventoryLotId: 'lot-1',
    });
    expect(readOrder(createMedicationCopy(catalogDrug('med-1'), lot)).inventoryLotId).toBeUndefined();
  });
});
