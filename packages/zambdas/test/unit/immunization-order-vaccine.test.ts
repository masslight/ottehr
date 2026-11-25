import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration, Practitioner } from 'fhir/r4b';
import { InputImmunizationOrderDetails } from 'utils/lib/types/data/immunization/types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import {
  CONTAINED_MEDICATION_ID,
  IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL,
  updateOrderDetails,
} from '../../src/ehr/immunization/common';

const practitioner: Practitioner = { resourceType: 'Practitioner', id: 'pr-1', name: [{ family: 'Lee' }] };

const LEGACY_VACCINE: Medication = {
  resourceType: 'Medication',
  id: CONTAINED_MEDICATION_ID,
  identifier: [
    { system: 'virtual-medication-type', value: 'virtual-vaccine-inventory' },
    { system: 'virtual-medication-identifier-name-system', value: 'Tdap (Adacel/Boostrix)' },
  ],
  extension: [{ url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL, valueString: 'config-medication-tdap' }],
};

const newOrder = (): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  status: 'in-progress',
  subject: { reference: 'Patient/p1' },
  effectiveDateTime: '2026-11-25T10:00:00Z',
});

const legacyOrder = (): MedicationAdministration => ({
  ...newOrder(),
  id: 'order-1',
  medicationReference: { reference: '#' + CONTAINED_MEDICATION_ID },
  contained: [structuredClone(LEGACY_VACCINE)],
});

const details = (medication: { id: string; name: string }): InputImmunizationOrderDetails => ({
  medication,
  dose: '0.5',
  units: 'mL',
  orderedProvider: { id: 'pr-1', name: 'Ann Lee' },
});

const mockOystehr = (): { oystehr: Oystehr; get: ReturnType<typeof vi.fn> } => {
  const get = vi.fn().mockResolvedValue(practitioner);
  return { oystehr: { fhir: { get } } as unknown as Oystehr, get };
};

const orderVaccine = (order: MedicationAdministration): Medication | undefined =>
  order.contained?.find((resource) => resource.id === CONTAINED_MEDICATION_ID) as Medication | undefined;

describe('immunization updateOrderDetails - vaccine', () => {
  it('orders a vaccine from the CVX list without reading a Medication resource', async () => {
    const order = newOrder();
    const { oystehr, get } = mockOystehr();

    await updateOrderDetails(order, details({ id: '115', name: 'Tdap' }), oystehr);

    expect(order.medicationReference).toEqual({ reference: '#' + CONTAINED_MEDICATION_ID });
    expect(orderVaccine(order)).toEqual({
      resourceType: 'Medication',
      id: CONTAINED_MEDICATION_ID,
      identifier: [
        { system: 'virtual-medication-type', value: 'virtual-vaccine-inventory' },
        { system: 'virtual-medication-identifier-name-system', value: 'Tdap' },
      ],
      code: {
        coding: [
          {
            system: 'http://hl7.org/fhir/sid/cvx',
            code: '115',
            display: 'tetanus toxoid, reduced diphtheria toxoid, and acellular pertussis vaccine, adsorbed',
          },
        ],
      },
      extension: [{ url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL, valueString: '115' }],
    });
    expect(get).not.toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'Medication' }));
  });

  it('rejects a new order for a vaccine that is not in the CVX list', async () => {
    const order = newOrder();

    await expect(
      updateOrderDetails(
        order,
        details({ id: 'config-medication-tdap', name: 'Tdap (Adacel/Boostrix)' }),
        mockOystehr().oystehr
      )
    ).rejects.toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
      message: expect.stringContaining('"Tdap (Adacel/Boostrix)" is not in the vaccine list'),
    });
    expect(order.contained).toBeUndefined();
  });

  it('keeps the vaccine an order was placed with before the CVX list', async () => {
    const order = legacyOrder();

    await updateOrderDetails(
      order,
      details({ id: 'config-medication-tdap', name: 'Tdap (Adacel/Boostrix)' }),
      mockOystehr().oystehr
    );

    expect(orderVaccine(order)).toEqual(LEGACY_VACCINE);
  });

  it('replaces the old vaccine of such an order once a vaccine from the list is picked', async () => {
    const order = legacyOrder();

    await updateOrderDetails(order, details({ id: '03', name: 'MMR' }), mockOystehr().oystehr);

    expect(orderVaccine(order)?.identifier?.[1]?.value).toBe('MMR');
    expect(orderVaccine(order)?.code?.coding?.[0]?.code).toBe('03');
    expect(orderVaccine(order)?.extension).toEqual([
      { url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL, valueString: '03' },
    ]);
  });
});
