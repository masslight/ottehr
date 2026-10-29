import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import {
  Appointment,
  Coding,
  DeviceRequest,
  Encounter,
  FhirResource,
  Patient,
  Procedure,
  RelatedPerson,
} from 'fhir/r4b';
import { DmeOrderFieldsSchema } from 'utils/lib/types/api/dme.types';
import { describe, expect, it } from 'vitest';
import { performMerge } from '../../src/ehr/merge-patients/perform';
import {
  DME_BILLED_ORDER_EXTENSION_URL,
  getDmeBillingProcedureIds,
  makeDmeBillingProcedures,
  makeDmeDeviceRequest,
} from '../../src/shared/dme';

type AnyResource = FhirResource & Record<string, any>;

const MAIN_ID = 'main-patient';
const OTHER_ID = 'other-patient';
const MAIN_REF = `Patient/${MAIN_ID}`;
const OTHER_REF = `Patient/${OTHER_ID}`;

const refsOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).map((v) => v?.reference).filter((ref): ref is string => !!ref);
const patientRefs = (r: AnyResource): string[] => [
  ...refsOf(r.subject),
  ...refsOf(r.patient),
  ...refsOf(r.beneficiary),
  ...refsOf(r.subscriber),
];

const tokenMatches = (codings: Coding[] | undefined, value: string): boolean =>
  value.split(',').some((token) => {
    const [system, code] = token.includes('|') ? token.split('|') : [undefined, token];
    return (codings ?? []).some((c) => (system === undefined || c.system === system) && (!code || c.code === code));
  });

/** In-memory FHIR server for the searches, reads and transactions performMerge issues; unknown params throw. */
const createFakeFhir = (
  seed: FhirResource[]
): { oystehr: Oystehr; store: Map<string, AnyResource>; transactions: BatchInputRequest<FhirResource>[][] } => {
  const store = new Map<string, AnyResource>(seed.map((r) => [`${r.resourceType}/${r.id}`, structuredClone(r)]));
  const transactions: BatchInputRequest<FhirResource>[][] = [];
  const encounterSubject = (id: string): string | undefined => store.get(`Encounter/${id}`)?.subject?.reference;

  const matchers: Record<string, (r: AnyResource, value: string) => boolean> = {
    _id: (r, v) => r.id === v,
    subject: (r, v) => patientRefs(r).includes(v),
    patient: (r, v) => patientRefs(r).includes(v),
    actor: (r, v) => (r.participant ?? []).some((p: any) => p.actor?.reference === v),
    appointment: (r, v) => refsOf(r.appointment).includes(v),
    encounter: (r, v) => refsOf(r.encounter).includes(v),
    context: (r, v) => refsOf(r.context).includes(v),
    'subject:Patient._has:Encounter:subject:_id': (r, v) => refsOf(r.subject).includes(encounterSubject(v) ?? ''),
    'patient:Patient._has:Encounter:subject:_id': (r, v) => refsOf(r.patient).includes(encounterSubject(v) ?? ''),
    _tag: (r, v) => tokenMatches(r.meta?.tag, v),
    code: (r, v) => tokenMatches(r.code?.coding, v),
    _count: () => true,
    _revinclude: () => true,
  };

  const search = (resourceType: string, params: [string, string][]): AnyResource[] =>
    [...store.values()]
      .filter((r) => r.resourceType === resourceType)
      .filter((r) =>
        params.every(([name, value]) => {
          const matcher = matchers[name];
          if (!matcher) throw new Error(`fake FHIR: unsupported search parameter "${name}" on ${resourceType}`);
          return matcher(r, value);
        })
      )
      .map((r) => structuredClone(r));

  const parseUrl = (url: string): { resourceType: string; params: [string, string][] } => {
    const [path, query = ''] = url.replace(/^\//, '').split('?');
    const params = query
      .split('&')
      .filter(Boolean)
      .map((pair): [string, string] => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)]);
    return { resourceType: path, params };
  };

  const oystehr = {
    fhir: {
      search: async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
        const results = search(
          resourceType,
          params.map((p): [string, string] => [p.name, p.value])
        );
        return { unbundle: () => results };
      },
      batch: async ({ requests }: { requests: { method: string; url: string }[] }) => ({
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: requests.map((request) => {
          const { resourceType, params } = parseUrl(request.url);
          return {
            response: { status: '200', outcome: { resourceType: 'OperationOutcome', id: 'ok', issue: [] } },
            resource: {
              resourceType: 'Bundle',
              type: 'searchset',
              entry: search(resourceType, params).map((resource) => ({ resource })),
            },
          };
        }),
      }),
      get: async ({ resourceType, id }: { resourceType: string; id: string }) => {
        const found = store.get(`${resourceType}/${id}`);
        if (!found) throw new Error(`fake FHIR: ${resourceType}/${id} not found`);
        return structuredClone(found);
      },
      transaction: async ({ requests }: { requests: BatchInputRequest<FhirResource>[] }) => {
        transactions.push(requests);
        for (const request of requests) {
          if (request.method !== 'PUT') throw new Error(`fake FHIR: unexpected ${request.method} ${request.url}`);
          store.set(request.url.replace(/^\//, ''), structuredClone(request.resource) as AnyResource);
        }
        return { resourceType: 'Bundle', type: 'transaction-response' };
      },
      create: async (resource: FhirResource) => ({ ...resource, id: 'created-1' }),
    },
  } as unknown as Oystehr;

  return { oystehr, store, transactions };
};

const dmeFields = DmeOrderFieldsSchema.parse({
  itemName: 'Ankle Brace',
  quantity: 2,
  orderedByPractitionerId: '0b5a2c8e-1f3d-4c6e-9a7b-2d4f6e8a0c1b',
  billingCodes: [
    { code: 'L1906', display: 'Ankle foot orthosis, multiligamentous ankle support' },
    { code: 'L4361', display: 'Walking boot, pneumatic' },
  ],
});

const dmeOrder = (id: string, encounterId: string, patientId: string, billingIds: string[]): FhirResource[] => {
  const deviceRequest: DeviceRequest = {
    ...makeDmeDeviceRequest({
      fields: dmeFields,
      encounterId,
      patientId,
      billingProcedureReferences: billingIds.map((billingId) => `Procedure/${billingId}`),
    }),
    id,
  };
  const billing = makeDmeBillingProcedures({
    fields: dmeFields,
    encounterId,
    patientId,
    deviceRequestReference: `DeviceRequest/${id}`,
  }).map((procedure, index): Procedure => ({ ...procedure, id: billingIds[index] }));
  return [deviceRequest, ...billing];
};

const seed = (): FhirResource[] => {
  const patients: Patient[] = [
    { resourceType: 'Patient', id: MAIN_ID, active: true },
    { resourceType: 'Patient', id: OTHER_ID, active: true },
  ];
  const appointment: Appointment = {
    resourceType: 'Appointment',
    id: 'other-appointment',
    status: 'fulfilled',
    participant: [{ actor: { reference: OTHER_REF }, status: 'accepted' }],
  };
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: 'other-encounter',
    status: 'finished',
    class: { code: 'AMB' },
    subject: { reference: OTHER_REF },
    appointment: [{ reference: 'Appointment/other-appointment' }],
  };
  return [
    ...patients,
    appointment,
    encounter,
    ...dmeOrder('visit-order', 'other-encounter', OTHER_ID, ['visit-billing-1', 'visit-billing-2']),
    ...dmeOrder('orphan-order', 'missing-encounter', OTHER_ID, ['orphan-billing-1', 'orphan-billing-2']),
    ...dmeOrder('main-order', 'main-encounter', MAIN_ID, ['main-billing-1', 'main-billing-2']),
  ];
};

const runMerge = async (extraSeed: FhirResource[] = []): Promise<ReturnType<typeof createFakeFhir>> => {
  const fake = createFakeFhir([...seed(), ...extraSeed]);
  await performMerge(
    {
      mainPatientId: MAIN_ID,
      otherPatientId: OTHER_ID,
      questionnaireResponse: { resourceType: 'QuestionnaireResponse', status: 'completed', item: [] },
      providerProfileReference: 'Practitioner/admin',
      secrets: null,
    },
    fake.oystehr,
    'token'
  );
  return fake;
};

describe('performMerge — DME orders', () => {
  it("moves the merged patient's DME orders and their billing lines to the surviving patient", async () => {
    const { store } = await runMerge();

    for (const id of ['visit-order', 'orphan-order']) {
      const order = store.get(`DeviceRequest/${id}`) as DeviceRequest;
      expect(order.subject.reference).toBe(MAIN_REF);
      const billingIds = getDmeBillingProcedureIds(order);
      expect(billingIds).toHaveLength(2);
      for (const billingId of billingIds) {
        const procedure = store.get(`Procedure/${billingId}`) as Procedure;
        expect(procedure.subject.reference).toBe(MAIN_REF);
        expect(procedure.extension).toContainEqual({
          url: DME_BILLED_ORDER_EXTENSION_URL,
          valueReference: { reference: `DeviceRequest/${id}` },
        });
      }
    }
    expect((store.get('DeviceRequest/visit-order') as DeviceRequest).encounter?.reference).toBe(
      'Encounter/other-encounter'
    );
    expect([...store.values()].filter((r) => patientRefs(r).includes(OTHER_REF))).toEqual([]);
  });

  it("updates each order once and leaves the surviving patient's own orders alone", async () => {
    const { transactions } = await runMerge();
    const urls = transactions.flat().map((request) => request.url);

    expect(urls.filter((url) => url === '/DeviceRequest/visit-order')).toHaveLength(1);
    expect(urls.filter((url) => url === '/DeviceRequest/orphan-order')).toHaveLength(1);
    expect(urls.filter((url) => url.startsWith('/DeviceRequest/main-order') || url.includes('main-billing'))).toEqual(
      []
    );
  });
});

const relatedPerson = (id: string, patientId: string, coding: Coding): RelatedPerson => ({
  resourceType: 'RelatedPerson',
  id,
  patient: { reference: `Patient/${patientId}` },
  relationship: [{ coding: [coding] }],
});
const emergencyContactCoding: Coding = {
  system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
  code: 'EP',
  display: 'Spouse',
};
const attorneyCoding: Coding = { code: 'OTHER', display: 'MVA Attorney' };

describe('performMerge — related persons', () => {
  const otherRelatedPersons = (): RelatedPerson[] => [
    relatedPerson('other-emergency-contact', OTHER_ID, emergencyContactCoding),
    relatedPerson('other-attorney', OTHER_ID, attorneyCoding),
    relatedPerson('other-contact', OTHER_ID, {
      system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
      code: 'C',
      display: 'Emergency Contact',
    }),
  ];
  const mainRelatedPersonIds = (store: Map<string, AnyResource>): (string | undefined)[] =>
    [...store.values()]
      .filter((r) => r.resourceType === 'RelatedPerson' && patientRefs(r).includes(MAIN_REF))
      .map((r) => r.id)
      .sort();

  it("keeps the surviving patient's own emergency contact and attorney", async () => {
    const { store } = await runMerge([
      relatedPerson('main-emergency-contact', MAIN_ID, emergencyContactCoding),
      relatedPerson('main-attorney', MAIN_ID, attorneyCoding),
      ...otherRelatedPersons(),
    ]);

    expect(mainRelatedPersonIds(store)).toEqual(['main-attorney', 'main-emergency-contact', 'other-contact']);
    expect(store.get('RelatedPerson/other-emergency-contact')?.patient.reference).toBe(OTHER_REF);
    expect(store.get('RelatedPerson/other-attorney')?.patient.reference).toBe(OTHER_REF);
  });

  it("moves the other patient's emergency contact and attorney when the surviving patient has none", async () => {
    const { store } = await runMerge([
      ...otherRelatedPersons(),
      relatedPerson('other-emergency-contact-2', OTHER_ID, emergencyContactCoding),
    ]);

    expect(mainRelatedPersonIds(store)).toEqual(['other-attorney', 'other-contact', 'other-emergency-contact']);
    expect(store.get('RelatedPerson/other-emergency-contact-2')?.patient.reference).toBe(OTHER_REF);
  });
});
