import { ActivityDefinition, Coverage, Encounter, Location, Patient, Provenance, ServiceRequest, Task } from 'fhir/r4b';
import { DiagnosisDTO } from 'utils';
import { describe, expect, test } from 'vitest';
import { CreateInHouseLabResources, makeRequestsForCreateInHouseLabs } from '../../src/shared/in-house-lab/build-order';
import activityDefinitions from '../data/in-house-lab-activity-definitions.json';

const snellenAd = activityDefinitions.snellen.resource as ActivityDefinition;

const buildEncounter = (): Encounter => ({
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { reference: 'Patient/pat-1' },
  appointment: [{ reference: 'Appointment/appt-1' }],
});

const buildPatient = (): Patient => ({
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ family: 'Smith', given: ['Alex'] }],
});

const buildCoverage = (): Coverage => ({
  resourceType: 'Coverage',
  id: 'cov-1',
  status: 'active',
  beneficiary: { reference: 'Patient/pat-1' },
  payor: [{ display: 'Test Payor' }],
});

const buildLocation = (): Location => ({
  resourceType: 'Location',
  id: 'loc-1',
  name: 'Clinic',
});

const buildBaseResources = (overrides: Partial<CreateInHouseLabResources> = {}): CreateInHouseLabResources => ({
  diagnosesAll: [{ code: 'J02.9', display: 'Acute pharyngitis, unspecified', isPrimary: false } as DiagnosisDTO],
  notes: 'Test note',
  testResources: [
    {
      activityDefinition: snellenAd,
      initialServiceRequest: undefined,
      orderMode: 'standard',
    },
  ],
  encounter: buildEncounter(),
  patient: buildPatient(),
  coverage: buildCoverage(),
  location: buildLocation(),
  currentUserPractitionerName: 'Dr. User',
  currentUserPractitionerId: 'prac-user',
  attendingPractitionerName: 'Dr. Attending',
  attendingPractitionerId: 'prac-attending',
  ...overrides,
});

// Pick the POST request for a given resourceType out of the helper's mixed output.
// Returns a loosely-typed shape (the runtime narrows by resourceType but the helper's
// declared union doesn't narrow at compile time on its .resource branch).
type AnyPostRequest = ReturnType<typeof makeRequestsForCreateInHouseLabs>[number] & {
  resource: { resourceType: string };
  fullUrl?: string;
};
const pickRequestByType = (
  requests: ReturnType<typeof makeRequestsForCreateInHouseLabs>,
  resourceType: string
): AnyPostRequest[] => {
  return (requests as AnyPostRequest[]).filter((r) => r.resource.resourceType === resourceType);
};

describe('makeRequestsForCreateInHouseLabs', () => {
  test('emits one ServiceRequest, Task, Procedure (CPT), and Provenance for a single in-house lab order', () => {
    const requests = makeRequestsForCreateInHouseLabs(buildBaseResources());

    const srs = pickRequestByType(requests, 'ServiceRequest');
    const tasks = pickRequestByType(requests, 'Task');
    const procs = pickRequestByType(requests, 'Procedure');
    const provs = pickRequestByType(requests, 'Provenance');

    expect(srs).toHaveLength(1);
    expect(tasks).toHaveLength(1);
    // The snellen AD has exactly one CPT coding (99173).
    expect(procs).toHaveLength(1);
    expect(provs).toHaveLength(1);

    // Each entry posts to its REST collection path.
    expect(srs[0]).toMatchObject({ method: 'POST', url: '/ServiceRequest' });
    expect(tasks[0]).toMatchObject({ method: 'POST', url: '/Task' });
    expect(procs[0]).toMatchObject({ method: 'POST', url: '/Procedure' });
    expect(provs[0]).toMatchObject({ method: 'POST', url: '/Provenance' });
  });

  test('ServiceRequest carries the right status, intent, references, and AD canonical', () => {
    const requests = makeRequestsForCreateInHouseLabs(buildBaseResources());
    const sr = pickRequestByType(requests, 'ServiceRequest')[0].resource as ServiceRequest;

    expect(sr.status).toBe('draft');
    expect(sr.intent).toBe('order');
    expect(sr.priority).toBe('stat');
    expect(sr.subject?.reference).toBe('Patient/pat-1');
    expect(sr.encounter?.reference).toBe('Encounter/enc-1');
    expect(sr.instantiatesCanonical).toEqual([`${snellenAd.url}|${snellenAd.version}`]);
    expect(sr.code?.text).toBe(snellenAd.name);
    expect(sr.note?.[0]?.text).toBe('Test note');
    expect(sr.insurance?.[0]?.reference).toBe('Coverage/cov-1');
    expect(sr.locationReference?.[0]?.reference).toBe('Location/loc-1');
  });

  test('reasonCode is built from the DiagnosisDTOs', () => {
    const requests = makeRequestsForCreateInHouseLabs(buildBaseResources());
    const sr = pickRequestByType(requests, 'ServiceRequest')[0].resource as ServiceRequest;

    expect(sr.reasonCode).toHaveLength(1);
    expect(sr.reasonCode?.[0]?.coding?.[0]).toMatchObject({
      code: 'J02.9',
      display: 'Acute pharyngitis, unspecified',
    });
    expect(sr.reasonCode?.[0]?.text).toBe('Acute pharyngitis, unspecified');
  });

  test('SR.requester defaults to attendingPractitionerId when requesterPractitionerId is not supplied', () => {
    // This is the legacy behavior - the refactor must not silently change it for the
    // create-in-house-lab-order callers that don't opt into the new param.
    const requests = makeRequestsForCreateInHouseLabs(buildBaseResources());
    const sr = pickRequestByType(requests, 'ServiceRequest')[0].resource as ServiceRequest;
    expect(sr.requester?.reference).toBe('Practitioner/prac-attending');
  });

  test('SR.requester honours requesterPractitionerId when supplied (new apply-template path)', () => {
    const requests = makeRequestsForCreateInHouseLabs(buildBaseResources({ requesterPractitionerId: 'prac-user' }));
    const sr = pickRequestByType(requests, 'ServiceRequest')[0].resource as ServiceRequest;
    expect(sr.requester?.reference).toBe('Practitioner/prac-user');
  });

  test('Task.basedOn and Provenance.target reference the new ServiceRequest by its fullUrl', () => {
    const requests = makeRequestsForCreateInHouseLabs(buildBaseResources());
    const srRequest = pickRequestByType(requests, 'ServiceRequest')[0];
    const task = pickRequestByType(requests, 'Task')[0].resource as Task;
    const provenance = pickRequestByType(requests, 'Provenance')[0].resource as Provenance;

    // Cross-references must point at the SR's urn:uuid so the transaction can resolve them.
    expect(srRequest.fullUrl).toMatch(/^urn:uuid:/);
    expect(task.basedOn?.[0]?.reference).toBe(srRequest.fullUrl);
    expect(provenance.target?.[0]?.reference).toBe(srRequest.fullUrl);
  });

  test('Provenance records the current user (agent.who) and the attending (agent.onBehalfOf)', () => {
    const requests = makeRequestsForCreateInHouseLabs(buildBaseResources());
    const provenance = pickRequestByType(requests, 'Provenance')[0].resource as Provenance;
    const agent = provenance.agent?.[0];
    expect(agent?.who?.reference).toBe('Practitioner/prac-user');
    expect(agent?.who?.display).toBe('Dr. User');
    expect(agent?.onBehalfOf?.reference).toBe('Practitioner/prac-attending');
    expect(agent?.onBehalfOf?.display).toBe('Dr. Attending');
  });

  test('omits insurance, note, and locationReference when those inputs are absent', () => {
    const requests = makeRequestsForCreateInHouseLabs(
      buildBaseResources({ coverage: undefined, location: undefined, notes: undefined })
    );
    const sr = pickRequestByType(requests, 'ServiceRequest')[0].resource as ServiceRequest;
    expect(sr.insurance).toBeUndefined();
    expect(sr.locationReference).toBeUndefined();
    expect(sr.note).toBeUndefined();
  });

  test('produces no Procedure entries when the ActivityDefinition has no CPT codings', () => {
    const adWithoutCpt: ActivityDefinition = {
      ...snellenAd,
      code: {
        ...snellenAd.code,
        coding: snellenAd.code?.coding?.filter((c) => c.system !== 'http://www.ama-assn.org/go/cpt'),
      },
    };
    const requests = makeRequestsForCreateInHouseLabs(
      buildBaseResources({
        testResources: [{ activityDefinition: adWithoutCpt, initialServiceRequest: undefined, orderMode: 'standard' }],
      })
    );
    expect(pickRequestByType(requests, 'Procedure')).toHaveLength(0);
    // The other three resources still come out.
    expect(pickRequestByType(requests, 'ServiceRequest')).toHaveLength(1);
    expect(pickRequestByType(requests, 'Task')).toHaveLength(1);
    expect(pickRequestByType(requests, 'Provenance')).toHaveLength(1);
  });

  test("'repeat' orderMode links basedOn to the initial SR and tags the new SR as a repeat", () => {
    const initial: ServiceRequest = {
      resourceType: 'ServiceRequest',
      id: 'initial-sr-1',
      status: 'completed',
      intent: 'order',
      subject: { reference: 'Patient/pat-1' },
    };
    const requests = makeRequestsForCreateInHouseLabs(
      buildBaseResources({
        testResources: [{ activityDefinition: snellenAd, initialServiceRequest: initial, orderMode: 'repeat' }],
      })
    );
    const sr = pickRequestByType(requests, 'ServiceRequest')[0].resource as ServiceRequest;
    expect(sr.basedOn?.[0]?.reference).toBe('ServiceRequest/initial-sr-1');
    expect(sr.meta?.tag?.some((t) => t.code === 'repeat')).toBe(true);
  });

  test('emits resources for each test in testResources', () => {
    const requests = makeRequestsForCreateInHouseLabs(
      buildBaseResources({
        testResources: [
          { activityDefinition: snellenAd, initialServiceRequest: undefined, orderMode: 'standard' },
          { activityDefinition: snellenAd, initialServiceRequest: undefined, orderMode: 'standard' },
        ],
      })
    );
    expect(pickRequestByType(requests, 'ServiceRequest')).toHaveLength(2);
    expect(pickRequestByType(requests, 'Task')).toHaveLength(2);
    expect(pickRequestByType(requests, 'Provenance')).toHaveLength(2);
  });
});
