// The vaccine of an immunization order comes from the vaccine list (CVX_VACCINES); an order placed before the
// list existed keeps the copy of the config Medication it was ordered from.
import Oystehr from '@oystehr/sdk';
import { MedicationAdministration, Practitioner } from 'fhir/r4b';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { CVX_VACCINES } from 'utils/lib/types/data/immunization/cvx-vaccines.generated';
import { InputImmunizationOrderDetails } from 'utils/lib/types/data/immunization/types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import {
  CONTAINED_MEDICATION_ID,
  getContainedMedication,
  IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL,
  updateOrderDetails,
} from '../../src/ehr/immunization/common';
import { mapMedicationAdministrationToImmunizationOrder } from '../../src/ehr/immunization/get-orders';

const LEGACY_MEDICATION_ID = 'a3f1c2d4-0000-4000-8000-000000000001';

const practitioner: Practitioner = { resourceType: 'Practitioner', id: 'pr-1', name: [{ family: 'Lee' }] };

const newOrder = (): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'order-1',
  status: 'in-progress',
  subject: { reference: 'Patient/p1' },
  context: { reference: 'Encounter/e1' },
  effectiveDateTime: '2026-10-27T10:00:00Z',
});

// As create-update-immunization-order stored it while vaccines were config Medications.
const legacyOrder = (): MedicationAdministration => ({
  ...newOrder(),
  medicationReference: { reference: '#' + CONTAINED_MEDICATION_ID },
  contained: [
    {
      resourceType: 'Medication',
      id: CONTAINED_MEDICATION_ID,
      identifier: [
        { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
        { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Tdap (Adacel/Boostrix)' },
      ],
      extension: [{ url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL, valueString: LEGACY_MEDICATION_ID }],
    },
  ],
});

const details = (medication: InputImmunizationOrderDetails['medication']): InputImmunizationOrderDetails => ({
  medication,
  dose: '0.5',
  units: 'mL',
  orderedProvider: { id: 'pr-1', name: 'Lee' },
});

const mockOystehr = (): { oystehr: Oystehr; get: ReturnType<typeof vi.fn> } => {
  const get = vi.fn(async () => practitioner);
  return { oystehr: { fhir: { get } } as unknown as Oystehr, get };
};

describe('immunization updateOrderDetails - vaccine', () => {
  it('builds the order vaccine from the vaccine list, whatever name the request carries', async () => {
    const order = newOrder();
    const { oystehr, get } = mockOystehr();

    await updateOrderDetails(order, details({ id: '115', name: 'not the list name' }), oystehr);

    expect(order.medicationReference).toEqual({ reference: '#' + CONTAINED_MEDICATION_ID });
    expect(getContainedMedication(order)).toEqual({
      resourceType: 'Medication',
      id: CONTAINED_MEDICATION_ID,
      identifier: [
        { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
        { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Tdap' },
      ],
      code: {
        coding: [
          {
            system: CVX_CODE_SYSTEM_URL,
            code: '115',
            display: CVX_VACCINES.find((vaccine) => vaccine.cvx === '115')?.fullName,
          },
        ],
      },
      extension: [{ url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL, valueString: '115' }],
    });
    // no Medication resource is read any more
    expect(get).not.toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'Medication' }));
    // the order form reads the vaccine back as the option it picked, and no CVX is filled in for it
    const read = mapMedicationAdministrationToImmunizationOrder(order);
    expect(read.details.medication).toEqual({ id: '115', name: 'Tdap' });
    expect(read.administrationDetails?.cvx ?? '').toBe('');
  });

  it('accepts every vaccine in the list', async () => {
    for (const vaccine of CVX_VACCINES) {
      const order = newOrder();
      await updateOrderDetails(order, details({ id: vaccine.cvx, name: vaccine.name }), mockOystehr().oystehr);
      expect(getMedicationName(getContainedMedication(order))).toBe(vaccine.name);
    }
  });

  it('rejects a vaccine that is not in the list', async () => {
    await expect(
      updateOrderDetails(newOrder(), details({ id: LEGACY_MEDICATION_ID, name: 'Flu (Adult)' }), mockOystehr().oystehr)
    ).rejects.toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
      message: expect.stringContaining('"Flu (Adult)" is not in the vaccine list'),
    });
  });

  it('keeps the vaccine of an order placed before the list while it is not changed', async () => {
    const order = legacyOrder();
    const before = structuredClone(getContainedMedication(order));

    await updateOrderDetails(
      order,
      details({ id: LEGACY_MEDICATION_ID, name: 'Tdap (Adacel/Boostrix)' }),
      mockOystehr().oystehr
    );

    expect(getContainedMedication(order)).toEqual(before);
    expect(mapMedicationAdministrationToImmunizationOrder(order).details.medication).toEqual({
      id: LEGACY_MEDICATION_ID,
      name: 'Tdap (Adacel/Boostrix)',
    });
  });

  it('moves an order placed before the list to a list vaccine when the user picks one', async () => {
    const order = legacyOrder();

    await updateOrderDetails(order, details({ id: '115', name: 'Tdap' }), mockOystehr().oystehr);

    expect(mapMedicationAdministrationToImmunizationOrder(order).details.medication).toEqual({
      id: '115',
      name: 'Tdap',
    });
  });
});
