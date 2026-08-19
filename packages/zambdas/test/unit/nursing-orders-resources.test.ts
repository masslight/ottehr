import { Provenance, ServiceRequest, Task } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import {
  NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY,
  VITALS_RECHECK_NURSING_ORDER_NOTE,
} from 'utils/lib/types/data/orders/constants';
import { describe, expect, test } from 'vitest';
import { makeNursingOrderTransactionRequests, NursingOrderResourcesInput } from '../../src/shared/nursing-orders';

const baseInput: NursingOrderResourcesInput = {
  encounterId: 'enc-1',
  patientId: 'pat-1',
  patientName: 'Jane Doe',
  attendingPractitionerId: 'attending-1',
  createdByPractitionerId: 'nurse-1',
  notes: 'Check vitals',
  locationId: 'loc-1',
};

const build = (
  overrides: Partial<NursingOrderResourcesInput> = {}
): { serviceRequest: ServiceRequest; task: Task; provenance: Provenance } => {
  const requests = makeNursingOrderTransactionRequests({ ...baseInput, ...overrides });
  return {
    serviceRequest: requests[0].resource as ServiceRequest,
    task: requests[1].resource as Task,
    provenance: requests[2].resource as Provenance,
  };
};

// A nursing order is three resources that only read back correctly as a set: get-nursing-orders
// finds the ServiceRequest by meta tag, takes the displayed status from the Task it locates via
// Task.basedOn, and throws outright if no create-order Provenance targets the ServiceRequest. These
// tests pin that contract, because the vitals re-check order raised automatically on IV medication
// administration goes through this same builder and has to be indistinguishable from a manual one.
describe('makeNursingOrderTransactionRequests', () => {
  test('posts exactly ServiceRequest, Task and Provenance', () => {
    const requests = makeNursingOrderTransactionRequests(baseInput);
    expect(requests.map((request) => ({ method: request.method, url: request.url }))).toEqual([
      { method: 'POST', url: '/ServiceRequest' },
      { method: 'POST', url: '/Task' },
      { method: 'POST', url: '/Provenance' },
    ]);
  });

  test('links the Task and Provenance to the ServiceRequest by its transaction fullUrl', () => {
    const requests = makeNursingOrderTransactionRequests(baseInput);
    const fullUrl = requests[0].fullUrl;

    expect(fullUrl).toMatch(/^urn:uuid:/);
    expect((requests[1].resource as Task).basedOn?.[0]?.reference).toBe(fullUrl);
    expect((requests[2].resource as Provenance).target?.[0]?.reference).toBe(fullUrl);
  });

  test('tags the ServiceRequest so the nursing orders search finds it', () => {
    const { serviceRequest } = build();
    expect(serviceRequest.meta?.tag).toEqual([
      { code: 'nursing order', system: `${PRIVATE_EXTENSION_BASE_URL}/order-type-tag` },
    ]);
  });

  test('gives the Task the status that reads back as pending', () => {
    const { task } = build();
    expect(task.status).toBe('requested');
  });

  test('carries the create-order activity the reader requires on the Provenance', () => {
    const { provenance } = build();
    expect(provenance.activity?.coding).toEqual([NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder]);
  });

  test('records the creating practitioner as agent and the attender as requester', () => {
    const { serviceRequest, provenance } = build();
    expect(serviceRequest.requester?.reference).toBe('Practitioner/attending-1');
    expect(provenance.agent?.[0]?.who?.reference).toBe('Practitioner/nurse-1');
    expect(provenance.agent?.[0]?.onBehalfOf?.reference).toBe('Practitioner/attending-1');
  });

  test('puts the order text where the UI reads it from', () => {
    const { serviceRequest } = build({ notes: VITALS_RECHECK_NURSING_ORDER_NOTE });
    expect(serviceRequest.note?.[0]?.text).toBe(VITALS_RECHECK_NURSING_ORDER_NOTE);
  });

  test('omits note, location, insurance and supportingInfo when not supplied', () => {
    const { serviceRequest, task, provenance } = build({
      notes: undefined,
      locationId: undefined,
    });

    expect(serviceRequest.note).toBeUndefined();
    expect(serviceRequest.locationReference).toBeUndefined();
    expect(serviceRequest.insurance).toBeUndefined();
    expect(serviceRequest.supportingInfo).toBeUndefined();
    expect(task.location).toBeUndefined();
    expect(provenance.location).toBeUndefined();
  });

  test('records supportingInfo, the marker that makes the automatic re-check order idempotent', () => {
    const { serviceRequest } = build({ supportingInfoReferences: ['MedicationAdministration/ma-1'] });
    expect(serviceRequest.supportingInfo).toEqual([{ reference: 'MedicationAdministration/ma-1' }]);
  });

  test('references the encounter, patient and location on the resources that carry them', () => {
    const { serviceRequest, task, provenance } = build();

    expect(serviceRequest.subject.reference).toBe('Patient/pat-1');
    expect(serviceRequest.encounter?.reference).toBe('Encounter/enc-1');
    expect(serviceRequest.locationReference).toEqual([{ type: 'Location', reference: 'Location/loc-1' }]);
    expect(task.encounter?.reference).toBe('Encounter/enc-1');
    expect(task.description).toBe('Create nursing order for Jane Doe');
    expect(provenance.location?.reference).toBe('Location/loc-1');
  });
});
