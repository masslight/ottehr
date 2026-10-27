import { Medication, MedicationAdministration } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  applyOrderAdministrationDetails,
  CONTAINED_MEDICATION_ID,
  IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL,
} from '../../src/ehr/immunization/common';
import { mapMedicationAdministrationToImmunizationOrder } from '../../src/ehr/immunization/get-orders';

const pendingOrder = (): MedicationAdministration => {
  const medication: Medication = { resourceType: 'Medication', id: CONTAINED_MEDICATION_ID };
  return {
    resourceType: 'MedicationAdministration',
    id: 'order-1',
    status: 'in-progress',
    subject: { reference: 'Patient/p1' },
    effectiveDateTime: '2026-10-27T10:00:00Z',
    extension: [{ url: IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL, valueDateTime: '2026-10-27T10:00:00Z' }],
    medicationReference: { reference: '#' + CONTAINED_MEDICATION_ID },
    contained: [medication],
  };
};

const fullDetails = {
  lot: 'L1',
  expDate: '2027-01-31',
  mvx: 'SKB',
  cvx: '115',
  ndc: '58160-0842-11',
  cptCodes: [{ code: '90715', display: 'Tdap' }],
  administeredDateTime: '2026-10-28T09:30:00.000+01:00',
  visGiven: true,
  visGivenDate: '2026-10-28',
};

describe('applyOrderAdministrationDetails', () => {
  it('round-trips order-time administration fields through a pending order', () => {
    const order = pendingOrder();
    applyOrderAdministrationDetails(order, fullDetails);

    const mapped = mapMedicationAdministrationToImmunizationOrder(order);
    expect(mapped.status).toBe('pending');
    expect(mapped.details.orderedDateTime).toBe('2026-10-27T10:00:00Z');
    expect(mapped.administrationDetails).toEqual({
      ...fullDetails,
      administeredProvider: { id: '', name: '' },
      emergencyContact: undefined,
    });
  });

  it('clears fields that are no longer provided', () => {
    const order = pendingOrder();
    applyOrderAdministrationDetails(order, fullDetails);

    applyOrderAdministrationDetails(order, { cvx: '115' });

    expect(mapMedicationAdministrationToImmunizationOrder(order).administrationDetails).toMatchObject({
      lot: '',
      cvx: '115',
      cptCodes: [],
      administeredDateTime: '',
      visGiven: false,
      visGivenDate: undefined,
    });
  });

  it('leaves the order untouched when no administration details are sent', () => {
    const order = pendingOrder();
    applyOrderAdministrationDetails(order, fullDetails);
    const before = structuredClone(order);

    applyOrderAdministrationDetails(order, undefined);

    expect(order).toEqual(before);
  });

  it('returns no administration details for a pending order without them', () => {
    expect(mapMedicationAdministrationToImmunizationOrder(pendingOrder()).administrationDetails).toBeUndefined();
  });
});
