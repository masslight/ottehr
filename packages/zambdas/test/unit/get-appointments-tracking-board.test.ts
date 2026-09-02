import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  Bundle,
  Encounter,
  FhirResource,
  MedicationAdministration,
  MedicationRequest,
  Observation,
  Practitioner,
  ServiceRequest,
} from 'fhir/r4b';
import { ERX_MEDICATION_META_TAG_CODE, PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { ORDER_TYPE_CODE_SYSTEM } from 'utils/lib/fhir/radiology';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { IN_HOUSE_TEST_CODE_SYSTEM } from 'utils/lib/types/data/in-house/in-house.constants';
import { OYSTEHR_LAB_OI_CODE_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { describe, expect, test, vi } from 'vitest';
import {
  buildSearchUrl,
  executeBatchSearches,
  MAX_ENTRIES_PER_BATCH,
  toBatchRelativeUrl,
} from '../../src/ehr/get-appointments/batch-search';
import {
  buildOrdersForTrackingBoard,
  buildTrackingBoardSearchUrls,
  buildVitalsForTrackingBoard,
  classifyServiceRequest,
  emptyTrackingBoardExtras,
  partitionServiceRequests,
  poolTrackingBoardResources,
  selectTrackingBoardEncounterIds,
} from '../../src/ehr/get-appointments/tracking-board';
import { SortedAppointmentQueues } from '../../src/shared/queueingUtils';

const encounterIds = (count: number): string[] => Array.from({ length: count }, (_, index) => `enc-${index}`);

const serviceRequest = (id: string, overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id,
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/p1' },
  encounter: { reference: 'Encounter/enc-1' },
  ...overrides,
});

const appointment = (id: string): Appointment => ({
  resourceType: 'Appointment',
  id,
  status: 'booked',
  participant: [],
});

const encounter = (id: string, appointmentId: string): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'in-progress',
  class: { code: 'AMB' },
  appointment: [{ reference: `Appointment/${appointmentId}` }],
});

describe('batch-search', () => {
  test('buildSearchUrl writes values raw, the way the other batched searches do', () => {
    expect(
      buildSearchUrl('ServiceRequest', [
        { name: 'encounter', value: 'Encounter/a,Encounter/b' },
        { name: '_count', value: 500 },
      ])
    ).toBe('ServiceRequest?encounter=Encounter/a,Encounter/b&_count=500');
  });

  test('toBatchRelativeUrl strips the FHIR base, or the path prefix ahead of the resource type', () => {
    expect(
      toBatchRelativeUrl(
        'https://fhir-api.zapehr.com/r4/Observation?encounter=x&_page=2',
        'https://fhir-api.zapehr.com/r4'
      )
    ).toBe('Observation?encounter=x&_page=2');
    expect(toBatchRelativeUrl('https://fhir-api.zapehr.com/r4/Observation?encounter=x&_page=2', undefined)).toBe(
      'Observation?encounter=x&_page=2'
    );
  });

  test('executeBatchSearches splits entries at the concurrency limit, isolates failed entries and follows next links', async () => {
    const batchCalls: string[][] = [];
    const batch = vi.fn(async ({ requests }: { requests: { url: string }[] }): Promise<Bundle<FhirResource>> => {
      const urls = requests.map((request) => request.url);
      batchCalls.push(urls);
      return {
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: urls.map((url) => {
          if (url.includes('fail')) {
            return { response: { status: '400 Bad Request' } };
          }
          const searchset: Bundle<FhirResource> = {
            resourceType: 'Bundle',
            type: 'searchset',
            entry: [{ resource: { resourceType: 'Task', id: url, status: 'requested', intent: 'order' } }],
            ...(url.includes('paged') && !url.includes('_page')
              ? { link: [{ relation: 'next', url: `https://fhir.example.com/r4/${url}&_page=2` }] }
              : {}),
          };
          return { response: { status: '200 OK' }, resource: searchset };
        }),
      };
    });
    const oystehr = { fhir: { batch } } as unknown as Oystehr;

    const urls = [...Array.from({ length: 23 }, (_, index) => `Task?_id=t${index}`), 'Task?fail=1', 'Task?paged=1'];
    const result = await executeBatchSearches(oystehr, urls, { fhirApiUrl: 'https://fhir.example.com/r4' });

    // 25 entries -> 20 + 5, then one follow-up batch for the next page.
    expect(batchCalls.map((call) => call.length)).toEqual([MAX_ENTRIES_PER_BATCH, 5, 1]);
    expect(batchCalls[2]).toEqual(['Task?paged=1&_page=2']);
    expect(result.failedUrls).toEqual(['Task?fail=1']);
    // 23 plain + paged page 1 + paged page 2
    expect(result.resources).toHaveLength(25);
  });
});

describe('tracking board search plan', () => {
  test('one entry per resource family per encounter chunk, with only the includes the mappers read', () => {
    const urls = buildTrackingBoardSearchUrls(encounterIds(120), { orders: true, vitals: true });

    const byType = (prefix: string): string[] => urls.filter((url) => url.startsWith(`${prefix}?`));
    expect(byType('ServiceRequest')).toHaveLength(3);
    expect(byType('MedicationAdministration')).toHaveLength(3);
    expect(byType('MedicationRequest')).toHaveLength(3);
    expect(byType('Observation')).toHaveLength(5);
    expect(urls).toHaveLength(14);

    const serviceRequestUrl = byType('ServiceRequest')[0];
    expect(serviceRequestUrl).toContain('_revinclude=Task:based-on');
    expect(serviceRequestUrl).toContain('_revinclude=DiagnosticReport:based-on');
    expect(serviceRequestUrl).toContain('_revinclude:iterate=Task:based-on');
    expect(serviceRequestUrl).toContain('_include=ServiceRequest:instantiates-canonical');
    expect(serviceRequestUrl).toContain('status:not=revoked');
    // Context the legacy searches included and the board never rendered.
    expect(serviceRequestUrl).not.toContain('Encounter:appointment');
    expect(serviceRequestUrl).not.toContain('Coverage');
    expect(serviceRequestUrl).not.toContain('Slot');
    expect(serviceRequestUrl).not.toContain('DiagnosticReport:result');

    expect(byType('MedicationAdministration')[0]).toContain(
      '_tag=in-house-medication-administration-order,immunization'
    );
    expect(byType('MedicationRequest')[0]).toContain(`_tag=${ERX_MEDICATION_META_TAG_CODE}`);
  });

  test('include flags gate the entry families', () => {
    expect(buildTrackingBoardSearchUrls(encounterIds(10), { orders: true, vitals: false })).toHaveLength(3);
    expect(buildTrackingBoardSearchUrls(encounterIds(10), { orders: false, vitals: true })).toHaveLength(1);
    expect(buildTrackingBoardSearchUrls([], { orders: true, vitals: true })).toHaveLength(0);
  });

  test('selectTrackingBoardEncounterIds takes every in-office and discharged row, once', () => {
    const map: Record<string, Encounter> = {};
    const queued = (appointmentId: string, encounterId: string): Appointment => {
      map[`Appointment/${appointmentId}`] = encounter(encounterId, appointmentId);
      return appointment(appointmentId);
    };
    const queues: SortedAppointmentQueues = {
      prebooked: [queued('a-pre', 'e-pre')],
      inOffice: {
        waitingRoom: { arrived: [queued('a-arr', 'e-arr')], ready: [queued('a-ready', 'e-ready')] },
        inExam: {
          intake: [queued('a-int', 'e-int')],
          'ready for provider': [queued('a-r4p', 'e-r4p')],
          provider: [queued('a-prov', 'e-prov'), queued('a-prov-2', 'e-prov')],
        },
      },
      checkedOut: [queued('a-done', 'e-done')],
      canceled: [queued('a-can', 'e-can')],
    };

    expect(selectTrackingBoardEncounterIds(queues, map).sort()).toEqual(
      ['e-arr', 'e-ready', 'e-int', 'e-r4p', 'e-prov', 'e-done'].sort()
    );
  });

  test('emptyTrackingBoardExtras only carries the maps that were asked for', () => {
    const ordersOnly = emptyTrackingBoardExtras({ orders: true, vitals: false });
    expect(Object.keys(ordersOnly.orders ?? {})).toHaveLength(8);
    expect(ordersOnly.vitals).toBeUndefined();
    expect(emptyTrackingBoardExtras({ orders: false, vitals: true })).toEqual({ vitals: {} });
  });
});

describe('service request classification', () => {
  const externalLab = serviceRequest('ext', {
    code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: 'CBC' }] },
  });
  const inHouseLab = serviceRequest('ih', { code: { coding: [{ system: IN_HOUSE_TEST_CODE_SYSTEM, code: 'strep' }] } });
  const nursing = serviceRequest('nur', {
    meta: { tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/order-type-tag`, code: 'nursing order' }] },
  });
  const radiology = serviceRequest('rad', { meta: { tag: [{ system: ORDER_TYPE_CODE_SYSTEM, code: 'radiology' }] } });
  const procedure = serviceRequest('proc', { status: 'completed', meta: { tag: [{ code: 'procedure' }] } });
  const followUp = serviceRequest('other');

  test('each order type is recognised by the code system or tag its own search filtered on', () => {
    expect(classifyServiceRequest(externalLab)).toBe('externalLab');
    expect(classifyServiceRequest(inHouseLab)).toBe('inHouseLab');
    expect(classifyServiceRequest(nursing)).toBe('nursing');
    expect(classifyServiceRequest(radiology)).toBe('radiology');
    expect(classifyServiceRequest(procedure)).toBe('procedure');
    expect(classifyServiceRequest(followUp)).toBeUndefined();
  });

  test('partitions drop unknown orders and sort each type newest first', () => {
    const older = serviceRequest('nur-old', {
      meta: {
        lastUpdated: '2026-09-01T10:00:00Z',
        tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/order-type-tag`, code: 'nursing order' }],
      },
    });
    const newer = serviceRequest('nur-new', {
      meta: {
        lastUpdated: '2026-09-02T10:00:00Z',
        tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/order-type-tag`, code: 'nursing order' }],
      },
    });
    const partitions = partitionServiceRequests([older, followUp, newer, radiology]);
    expect(partitions.nursing.map((sr) => sr.id)).toEqual(['nur-new', 'nur-old']);
    expect(partitions.radiology.map((sr) => sr.id)).toEqual(['rad']);
    expect(partitions.externalLab).toEqual([]);
  });
});

describe('buildOrdersForTrackingBoard', () => {
  const enc1 = encounter('enc-1', 'appt-1');
  const appt1 = appointment('appt-1');

  const erx: MedicationRequest = {
    resourceType: 'MedicationRequest',
    id: 'mr-1',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/p1' },
    encounter: { reference: 'Encounter/enc-1' },
    meta: { tag: [{ code: ERX_MEDICATION_META_TAG_CODE }] },
  };
  const immunization: MedicationAdministration = {
    resourceType: 'MedicationAdministration',
    id: 'imm-1',
    status: 'in-progress',
    subject: { reference: 'Patient/p1' },
    context: { reference: 'Encounter/enc-1' },
    medicationReference: { reference: '#med' },
    meta: { tag: [{ code: 'immunization' }] },
    contained: [{ resourceType: 'Medication', id: 'med', code: { text: 'Influenza vaccine' } }],
  };
  const procedure = serviceRequest('proc-1', { status: 'completed', meta: { tag: [{ code: 'procedure' }] } });
  // A nursing order without its create-order Provenance makes the nursing mapper throw.
  const brokenNursing = serviceRequest('nur-1', {
    meta: { tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/order-type-tag`, code: 'nursing order' }] },
  });
  const followUp = serviceRequest('follow-up-1');

  test('maps and groups each order type, and a failing order drops only itself', () => {
    const pools = poolTrackingBoardResources([erx, immunization, procedure, brokenNursing, followUp, erx]);
    expect(pools.medicationRequests).toHaveLength(1); // deduped

    const table = buildOrdersForTrackingBoard({
      encounterIds: ['enc-1'],
      pools,
      encounters: [enc1],
      appointments: [appt1],
      practitioners: [],
      environment: 'local',
    });

    expect(table.erxOrdersByEncounterId['enc-1']).toHaveLength(1);
    expect(table.erxOrdersByEncounterId['enc-1'][0].resourceId).toBe('mr-1');
    expect(table.immunizationOrdersByEncounterId['enc-1']).toHaveLength(1);
    expect(table.immunizationOrdersByEncounterId['enc-1'][0].encounterId).toBe('enc-1');
    expect(table.proceduresByEncounterId['enc-1']).toHaveLength(1);
    expect(table.proceduresByEncounterId['enc-1'][0].resourceId).toBe('proc-1');
    expect(table.nursingOrdersByAppointmentId).toEqual({});
    expect(table.externalLabOrdersByAppointmentId).toEqual({});
    expect(table.inHouseLabOrdersByAppointmentId).toEqual({});
    expect(table.radiologyOrdersByAppointmentId).toEqual({});
    expect(table.inHouseMedicationsByEncounterId).toEqual({});
  });
});

describe('buildVitalsForTrackingBoard', () => {
  const performer: Practitioner = {
    resourceType: 'Practitioner',
    id: 'pr-1',
    name: [{ given: ['Ann'], family: 'Nurse' }],
  };
  const vital = (id: string, encounterId: string, abnormal: boolean): Observation => ({
    resourceType: 'Observation',
    id,
    status: 'final',
    code: { text: 'Temperature' },
    encounter: { reference: `Encounter/${encounterId}` },
    performer: [{ reference: 'Practitioner/pr-1' }],
    effectiveDateTime: '2026-09-02T10:00:00Z',
    valueQuantity: { value: abnormal ? 40.1 : 37 },
    meta: {
      tag: [
        {
          system: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}`,
          code: VitalFieldNames.VitalTemperature,
        },
      ],
    },
    ...(abnormal ? { interpretation: [{ coding: [{ code: 'HH' }] }] } : {}),
  });

  test('keeps only encounters with an abnormal reading, which is all the badge renders', () => {
    const vitals = buildVitalsForTrackingBoard({
      observations: [vital('o-1', 'enc-1', true), vital('o-2', 'enc-1', false), vital('o-3', 'enc-2', false)],
      practitioners: [performer],
    });

    expect(Object.keys(vitals)).toEqual(['enc-1']);
    const temperatures = vitals['enc-1'][VitalFieldNames.VitalTemperature];
    expect(temperatures).toHaveLength(1);
    expect(temperatures[0].resourceId).toBe('o-1');
    expect(temperatures[0].alertCriticality).toBeDefined();
    expect(temperatures[0].authorName).toContain('Ann');
  });
});
