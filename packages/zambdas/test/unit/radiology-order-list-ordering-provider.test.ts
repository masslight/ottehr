import { Encounter, Practitioner, ServiceRequest } from 'fhir/r4b';
import { PRACTITIONER_CODINGS } from 'utils';
import { describe, expect, test } from 'vitest';
import { resolveOrderingProvider } from '../../src/ehr/radiology/order-list';

const ATTENDER: Practitioner = {
  resourceType: 'Practitioner',
  id: 'attender-1',
  name: [{ family: 'Attending', given: ['Alice'] }],
};

const REQUESTER: Practitioner = {
  resourceType: 'Practitioner',
  id: 'requester-1',
  name: [{ family: 'Nurse', given: ['Nadia'] }],
};

const serviceRequest = (requesterId?: string): ServiceRequest =>
  ({
    resourceType: 'ServiceRequest',
    id: 'sr-1',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/patient-1' },
    ...(requesterId ? { requester: { reference: `Practitioner/${requesterId}` } } : {}),
  }) as ServiceRequest;

const encounter = (attenderId?: string): Encounter =>
  ({
    resourceType: 'Encounter',
    id: 'encounter-1',
    status: 'in-progress',
    class: { code: 'AMB' },
    ...(attenderId
      ? {
          participant: [
            {
              type: [{ coding: PRACTITIONER_CODINGS.Attender }],
              individual: { reference: `Practitioner/${attenderId}` },
            },
          ],
        }
      : {}),
  }) as Encounter;

describe('Radiology order-list - resolveOrderingProvider', () => {
  test("prefers the visit's attending provider over the requester who placed the order", () => {
    const resolved = resolveOrderingProvider(serviceRequest(REQUESTER.id), encounter(ATTENDER.id), [
      ATTENDER,
      REQUESTER,
    ]);
    expect(resolved?.id).toBe(ATTENDER.id);
  });

  test('falls back to the requester when the encounter has no attender', () => {
    const resolved = resolveOrderingProvider(serviceRequest(REQUESTER.id), encounter(), [ATTENDER, REQUESTER]);
    expect(resolved?.id).toBe(REQUESTER.id);
  });

  test('falls back to the requester when the encounter is missing from the bundle', () => {
    const resolved = resolveOrderingProvider(serviceRequest(REQUESTER.id), undefined, [ATTENDER, REQUESTER]);
    expect(resolved?.id).toBe(REQUESTER.id);
  });

  test("falls back to the requester when the attender's Practitioner did not come back in the bundle", () => {
    const resolved = resolveOrderingProvider(serviceRequest(REQUESTER.id), encounter(ATTENDER.id), [REQUESTER]);
    expect(resolved?.id).toBe(REQUESTER.id);
  });

  test('falls back to the requester when the attending provider has no name to display', () => {
    const namelessAttender: Practitioner = { ...ATTENDER, name: undefined };
    const resolved = resolveOrderingProvider(serviceRequest(REQUESTER.id), encounter(ATTENDER.id), [
      namelessAttender,
      REQUESTER,
    ]);
    expect(resolved?.id).toBe(REQUESTER.id);
  });

  test('resolves the attender when the order has no requester', () => {
    const resolved = resolveOrderingProvider(serviceRequest(), encounter(ATTENDER.id), [ATTENDER]);
    expect(resolved?.id).toBe(ATTENDER.id);
  });

  test('resolves nothing when neither provider is available', () => {
    expect(resolveOrderingProvider(serviceRequest(), encounter(), [ATTENDER, REQUESTER])).toBeUndefined();
  });
});
