// Immunization orders and in-house medication orders are both MedicationAdministrations, told apart by their tag.
// Each endpoint that takes an order id acts only on its own kind: an id of the other kind fails as a missing id
// does, so the response doesn't say the id exists. Exercises the real endpoint logic with an in-memory Oystehr.
import Oystehr from '@oystehr/sdk';
import { MedicationAdministration, Patient } from 'fhir/r4b';
import { IMMUNIZATION_ORDER_TAG_CODE, IMMUNIZATION_ORDER_TAG_SYSTEM } from 'utils/lib/fhir/medication-administration';
import {
  IN_HOUSE_CONTAINED_MEDICATION_ID,
  MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
  MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { AdministerImmunizationOrderRequest } from 'utils/lib/types/data/immunization/types';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import { performEffect } from '../../src/ehr/create-update-medication-order/index';
import { administerImmunizationOrder } from '../../src/ehr/immunization/administer-order/index';
import { cancelImmunizationOrder } from '../../src/ehr/immunization/cancel-order/index';
import { CONTAINED_MEDICATION_ID } from '../../src/ehr/immunization/common';
import { updateImmunizationOrder } from '../../src/ehr/immunization/create-update-order/index';
import { topLevelCatch } from '../../src/shared/lambda';

const vaccineOrder: MedicationAdministration = {
  resourceType: 'MedicationAdministration',
  id: 'vaccine-order',
  meta: { tag: [{ system: IMMUNIZATION_ORDER_TAG_SYSTEM, code: IMMUNIZATION_ORDER_TAG_CODE }] },
  status: 'in-progress',
  subject: { reference: 'Patient/maya' },
  context: { reference: 'Encounter/enc-1' },
  effectiveDateTime: '2026-11-10T09:00:00Z',
  medicationReference: { reference: `#${CONTAINED_MEDICATION_ID}` },
  performer: [],
  contained: [{ resourceType: 'Medication', id: CONTAINED_MEDICATION_ID, extension: [] }],
};

const medicationOrder: MedicationAdministration = {
  resourceType: 'MedicationAdministration',
  id: 'medication-order',
  meta: {
    tag: [
      {
        system: MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_SYSTEM,
        code: MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
      },
    ],
  },
  status: 'in-progress',
  subject: { reference: 'Patient/maya' },
  context: { reference: 'Encounter/enc-1' },
  effectiveDateTime: '2026-11-10T09:00:00Z',
  medicationReference: { reference: `#${IN_HOUSE_CONTAINED_MEDICATION_ID}` },
  performer: [],
  contained: [{ resourceType: 'Medication', id: IN_HOUSE_CONTAINED_MEDICATION_ID, code: { text: 'Ibuprofen' } }],
};

const patient: Patient = { resourceType: 'Patient', id: 'maya', birthDate: '2026-07-08' };

// what the SDK throws when the FHIR server has no resource with the id
const notFound = (): Error =>
  new Oystehr.OystehrFHIRError({
    code: 404,
    error: {
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'not-found', details: { text: 'Resource not found' } }],
    },
  });

const page = (resources: unknown[]): unknown => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource })),
  link: [],
  unbundle: () => resources,
});

/** Every write the endpoint sends, as "METHOD Type/id". */
function makeFakeOystehr(): { oystehr: Oystehr; writes: string[] } {
  const orders: Record<string, MedicationAdministration> = {
    [vaccineOrder.id!]: vaccineOrder,
    [medicationOrder.id!]: medicationOrder,
  };
  const writes: string[] = [];
  const fhir = {
    get: async ({ resourceType, id }: { resourceType: string; id: string }) => {
      if (resourceType === 'MedicationAdministration' && orders[id]) return structuredClone(orders[id]);
      if (resourceType === 'Medication') return { resourceType: 'Medication', id, code: { text: 'vax' } };
      if (resourceType === 'Encounter') return { resourceType: 'Encounter', id, status: 'in-progress' };
      if (resourceType === 'Patient') return structuredClone(patient);
      if (resourceType === 'Practitioner') return { resourceType: 'Practitioner', id, name: [{ family: 'P' }] };
      throw notFound();
    },
    // the in-house order endpoint reads the order with its patient: _id, nothing else narrowing the kind
    search: async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
      const id = params.find((p) => p.name === '_id')?.value;
      if (resourceType === 'MedicationAdministration' && id && orders[id])
        return page([structuredClone(orders[id]), structuredClone(patient)]);
      return page([]);
    },
    transaction: async ({ requests }: { requests: { method: string; url: string }[] }) => {
      for (const r of requests) writes.push(`${r.method} ${r.url.replace(/^\//, '')}`);
      return { entry: [] };
    },
    update: async (resource: MedicationAdministration) => {
      writes.push(`PUT ${resource.resourceType}/${resource.id}`);
      return resource;
    },
    create: async (resource: { resourceType: string }) => {
      writes.push(`POST ${resource.resourceType}`);
      return { ...resource, id: `new-${writes.length}` };
    },
    patch: async ({ resourceType, id }: { resourceType: string; id: string }) => {
      writes.push(`PATCH ${resourceType}/${id}`);
      return {};
    },
    delete: async ({ resourceType, id }: { resourceType: string; id: string }) => {
      writes.push(`DELETE ${resourceType}/${id}`);
    },
  };
  return { oystehr: { fhir } as unknown as Oystehr, writes };
}

const practitioner = { resourceType: 'Practitioner' as const, id: 'nurse-1', name: [{ given: ['N'], family: 'Urse' }] };

const details: AdministerImmunizationOrderRequest['details'] = {
  medication: { id: 'vax', name: 'vax' },
  dose: '0.5',
  units: 'mL',
  route: 'IM',
  location: { name: 'Thigh', code: 'x' },
  orderedProvider: { id: 'p', name: 'Dr. P' },
};

const administer = (oystehr: Oystehr, orderId: string): Promise<unknown> =>
  administerImmunizationOrder(
    oystehr,
    {
      orderId,
      type: 'administered',
      details,
      administrationDetails: {
        lot: 'L1',
        expDate: '2027-01-01',
        mvx: 'MSD',
        cvx: '146',
        ndc: '00000-0000-00',
        administeredDateTime: '2026-11-10T10:00:00Z',
        visGivenDate: '2026-11-10',
        cptCodes: [],
      },
    },
    practitioner
  );
const cancel = (oystehr: Oystehr, orderId: string): Promise<unknown> =>
  cancelImmunizationOrder(oystehr, oystehr, { orderId }, 'nurse-1');
const update = (oystehr: Oystehr, orderId: string): Promise<unknown> =>
  updateImmunizationOrder(oystehr, { orderId, encounterId: 'enc-1', details });

/** What the caller of the deployed endpoint receives for the error. */
const responseFor = async (call: Promise<unknown>): Promise<unknown> => {
  const error = await call.then(
    () => undefined,
    (e) => e
  );
  if (!error) return 'accepted';
  const { statusCode, body } = await topLevelCatch('test', error, 'local');
  return { statusCode, body };
};

describe('immunization order endpoints take only immunization orders', () => {
  const endpoints = {
    'administer-immunization-order': administer,
    'cancel-immunization-order': cancel,
    'create-update-immunization-order': update,
  };
  for (const [name, call] of Object.entries(endpoints)) {
    it(`${name} refuses an in-house medication order id and writes nothing`, async () => {
      const { oystehr, writes } = makeFakeOystehr();
      await expect(call(oystehr, medicationOrder.id!)).rejects.toThrow();
      expect(writes).toEqual([]);
    });

    it(`${name} answers an in-house medication order id exactly as a missing id`, async () => {
      const { oystehr } = makeFakeOystehr();
      const missing = await responseFor(call(oystehr, 'no-such-order'));
      expect(missing).toEqual({ statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) });
      expect(await responseFor(call(oystehr, medicationOrder.id!))).toEqual(missing);
    });

    it(`${name} still takes an immunization order`, async () => {
      const { oystehr, writes } = makeFakeOystehr();
      await call(oystehr, vaccineOrder.id!);
      expect(writes.some((w) => w.endsWith(`MedicationAdministration/${vaccineOrder.id}`))).toBe(true);
    });
  }
});

describe('create-update-medication-order takes only in-house medication orders', () => {
  const changeStatus = (oystehr: Oystehr, orderId: string): Promise<unknown> =>
    performEffect(oystehr, oystehr, { orderId, newStatus: 'cancelled' }, 'nurse-1');

  it('refuses an immunization order id and writes nothing', async () => {
    const { oystehr, writes } = makeFakeOystehr();
    await expect(changeStatus(oystehr, vaccineOrder.id!)).rejects.toThrow();
    expect(writes).toEqual([]);
  });

  it('answers an immunization order id with the error of a missing id', async () => {
    const { oystehr } = makeFakeOystehr();
    await expect(changeStatus(oystehr, 'no-such-order')).rejects.toEqual(
      FHIR_RESOURCE_NOT_FOUND_CUSTOM('No medicationAdministration was found with id no-such-order')
    );
    await expect(changeStatus(oystehr, vaccineOrder.id!)).rejects.toEqual(
      FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No medicationAdministration was found with id ${vaccineOrder.id}`)
    );
  });

  it('still takes an in-house medication order', async () => {
    const { oystehr, writes } = makeFakeOystehr();
    await changeStatus(oystehr, medicationOrder.id!);
    expect(writes).toContain(`PATCH MedicationAdministration/${medicationOrder.id}`);
  });
});
