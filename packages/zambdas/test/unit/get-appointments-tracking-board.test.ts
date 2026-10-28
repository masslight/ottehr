import Oystehr from '@oystehr/sdk';
import { captureException, captureMessage } from '@sentry/node-core/light';
import {
  Appointment,
  Bundle,
  DeviceRequest,
  DiagnosticReport,
  Encounter,
  FhirResource,
  MedicationAdministration,
  MedicationRequest,
  Observation,
  Patient,
  Practitioner,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { ERX_MEDICATION_META_TAG_CODE, PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { ORDER_TYPE_CODE_SYSTEM } from 'utils/lib/fhir/radiology';
import { VitalsSchema } from 'utils/lib/helpers/vitals/config-schema';
import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { DmeOrderFieldsSchema, DmeOrderStatus } from 'utils/lib/types/api/dme.types';
import { VitalsAlertConfig } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { IN_HOUSE_TEST_CODE_SYSTEM } from 'utils/lib/types/data/in-house/in-house.constants';
import { OYSTEHR_LAB_OI_CODE_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { DEFAULT_VITALS_ALERT_CONFIG, vitalsAlertConfigToVitalsDef } from 'utils/lib/utils/vitals-alert-config';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  buildSearchUrl,
  executeBatchSearches,
  MAX_ENTRIES_PER_BATCH,
  MAX_NEXT_PAGE_ROUNDS,
  nextPageUrl,
} from '../../src/ehr/get-appointments/batch-search';
import {
  buildOrdersForTrackingBoard,
  buildTrackingBoardSearches,
  buildVitalsForTrackingBoard,
  classifyServiceRequest,
  emptyTrackingBoardExtras,
  fetchTrackingBoardResources,
  partitionServiceRequests,
  poolTrackingBoardResources,
  selectTrackingBoardEncounterIds,
  selectVitalsPatientsByEncounterId,
  TRACKING_BOARD_ENTRIES_PER_BATCH,
  VitalsPatientsByEncounterId,
} from '../../src/ehr/get-appointments/tracking-board';
import { DME_ORDER_SEARCH_TAG, makeDmeDeviceRequest } from '../../src/shared/dme';
import { SortedAppointmentQueues } from '../../src/shared/queueingUtils';

const encounterIds = (count: number): string[] => Array.from({ length: count }, (_, index) => `enc-${index}`);

const sizeCapError = (): Error => new Error('Response payload size exceeds the maximum allowed size (6,291,456 bytes)');

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

  test('nextPageUrl advances _offset on the request itself, and only falls back to the server link without _count', () => {
    // The follow-up keeps the raw values the batch parser accepts; the server's (possibly encoded) link is ignored.
    expect(
      nextPageUrl(
        'ServiceRequest?encounter=Encounter/a&status:not=revoked&_count=500',
        'https://fhir.example.com/r4/ServiceRequest?encounter=Encounter%2Fa&status%3Anot=revoked&_count=500&_offset=500',
        'https://fhir.example.com/r4'
      )
    ).toBe('ServiceRequest?encounter=Encounter/a&status:not=revoked&_count=500&_offset=500');
    // A later page advances the existing offset.
    expect(nextPageUrl('Observation?_count=1000&_offset=1000', undefined, undefined)).toBe(
      'Observation?_count=1000&_offset=2000'
    );
    // No `_count` means no known page size: use the server's link, made relative, or nothing.
    expect(nextPageUrl('Task?based-on=x', 'https://fhir.example.com/r4/Task?based-on=x&_page=2', undefined)).toBe(
      'Task?based-on=x&_page=2'
    );
    expect(nextPageUrl('Task?based-on=x', undefined, undefined)).toBeUndefined();
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
            ...(url.includes('paged') && !url.includes('_page') && !url.includes('_offset')
              ? { link: [{ relation: 'next', url: `https://fhir.example.com/r4/${url}&_page=2` }] }
              : {}),
          };
          return { response: { status: '200 OK' }, resource: searchset };
        }),
      };
    });
    const oystehr = { fhir: { batch } } as unknown as Oystehr;

    const urls = [
      ...Array.from({ length: 23 }, (_, index) => `Task?_id=t${index}`),
      'Task?fail=1',
      'Task?paged=1',
      'Task?paged=2&_count=1',
    ];
    const result = await executeBatchSearches(
      oystehr,
      urls.map((url) => ({ url })),
      { fhirApiUrl: 'https://fhir.example.com/r4' }
    );

    // 26 entries -> 20 + 6, then one follow-up batch carrying both next pages.
    expect(batchCalls.map((call) => call.length)).toEqual([MAX_ENTRIES_PER_BATCH, 6, 2]);
    // Without `_count` the server's link is followed (made relative); with it the request itself is advanced a page.
    expect(batchCalls[2]).toEqual(['Task?paged=1&_page=2', 'Task?paged=2&_count=1&_offset=1']);
    expect(result.failedUrls).toEqual(['Task?fail=1']);
    // 23 plain + two paged searches with two pages each
    expect(result.resources).toHaveLength(27);
  });

  test('a later page split by encounter gets the full page budget, since its narrower searches restart at page one', async () => {
    // The parent's last page within the round cap is too large, and each half needs two pages of its own. Halves
    // that inherited the parent's round would stop after their first page and drop the rest without a failed URL.
    const pageOf = (url: string): number => Number(/_offset=(\d+)/.exec(url)?.[1] ?? 0);
    const isParent = (url: string): boolean => url.startsWith('Task?group=ab&');
    const batch = vi.fn(async ({ requests }: { requests: { url: string }[] }): Promise<Bundle<FhirResource>> => {
      if (requests.some(({ url }) => isParent(url) && pageOf(url) === MAX_NEXT_PAGE_ROUNDS)) throw sizeCapError();
      return {
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: requests.map(({ url }) => ({
          response: { status: '200 OK' },
          resource: {
            resourceType: 'Bundle',
            type: 'searchset',
            entry: [{ resource: { resourceType: 'Task', id: url, status: 'requested', intent: 'order' } }],
            ...(pageOf(url) < (isParent(url) ? MAX_NEXT_PAGE_ROUNDS : 1)
              ? { link: [{ relation: 'next', url: 'unused' }] }
              : {}),
          },
        })),
      };
    });
    const oystehr = { fhir: { batch } } as unknown as Oystehr;

    const result = await executeBatchSearches(oystehr, [
      {
        url: 'Task?group=ab&_count=1',
        split: () => [{ url: 'Task?group=a&_count=1' }, { url: 'Task?group=b&_count=1' }],
      },
    ]);

    expect(result.failedUrls).toEqual([]);
    expect(result.resources.map((resource) => resource.id)).toEqual(
      expect.arrayContaining(['Task?group=a&_count=1&_offset=1', 'Task?group=b&_count=1&_offset=1'])
    );
  });
});

describe('tracking board search plan', () => {
  test('one entry per resource family per encounter chunk, with only the includes the mappers read', () => {
    const urls = buildTrackingBoardSearches(encounterIds(120), true).map((search) => search.url);

    const byType = (prefix: string): string[] => urls.filter((url) => url.startsWith(`${prefix}?`));
    expect(byType('ServiceRequest')).toHaveLength(3);
    expect(byType('MedicationAdministration')).toHaveLength(3);
    expect(byType('MedicationRequest')).toHaveLength(3);
    expect(byType('DeviceRequest')).toHaveLength(3);
    expect(byType('Observation')).toHaveLength(5);
    expect(urls).toHaveLength(17);

    const serviceRequestUrl = byType('ServiceRequest')[0];
    expect(serviceRequestUrl).toContain('_revinclude=Task:based-on');
    expect(serviceRequestUrl).toContain('_revinclude=DiagnosticReport:based-on');
    expect(serviceRequestUrl).toContain('_revinclude:iterate=Task:based-on');
    expect(serviceRequestUrl).toContain('_include=ServiceRequest:instantiates-canonical');
    expect(serviceRequestUrl).toContain('status:not=revoked');
    expect(serviceRequestUrl).not.toContain('Encounter:appointment');
    expect(serviceRequestUrl).not.toContain('Coverage');
    expect(serviceRequestUrl).not.toContain('Slot');
    expect(serviceRequestUrl).not.toContain('DiagnosticReport:result');

    expect(byType('MedicationAdministration')[0]).toContain(
      '_tag=in-house-medication-administration-order,immunization'
    );
    expect(byType('MedicationRequest')[0]).toContain(`_tag=${ERX_MEDICATION_META_TAG_CODE}`);

    const dmeUrl = byType('DeviceRequest')[0];
    expect(dmeUrl).toContain(`_tag=${DME_ORDER_SEARCH_TAG}`);
    expect(dmeUrl).toContain('status=active');
    expect(dmeUrl).toContain('_include=DeviceRequest:requester');
  });

  test('DME orders get no entry when the feature is off', () => {
    expect(
      buildTrackingBoardSearches(encounterIds(120), false).filter((search) => search.url.startsWith('DeviceRequest?'))
    ).toHaveLength(0);
  });

  test('no encounters means no entries', () => {
    expect(buildTrackingBoardSearches([])).toHaveLength(0);
    expect(buildTrackingBoardSearches(encounterIds(10), false)).toHaveLength(4);
    expect(buildTrackingBoardSearches(encounterIds(10), true)).toHaveLength(5);
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

  test('emptyTrackingBoardExtras carries both maps, empty', () => {
    const extras = emptyTrackingBoardExtras();
    expect(Object.keys(extras.orders)).toHaveLength(9);
    expect(Object.values(extras.orders).every((group) => Object.keys(group).length === 0)).toBe(true);
    expect(extras.vitals).toEqual({});
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
    expect(table.dmeOrdersByEncounterId).toEqual({});
  });

  test('shows only in-house DME orders still waiting to be dispensed', () => {
    const requesterId = '6c3d2e1a-7b8f-4c5d-9e0a-1b2c3d4e5f60';
    const requester: Practitioner = {
      resourceType: 'Practitioner',
      id: requesterId,
      name: [{ given: ['Dana'], family: 'Doc' }],
    };
    const dmeOrder = (
      id: string,
      overrides: { external?: boolean; status?: DeviceRequest['status'] } = {}
    ): DeviceRequest => ({
      ...makeDmeDeviceRequest({
        fields: DmeOrderFieldsSchema.parse({
          itemName: `Item ${id}`,
          quantity: 1,
          orderedByPractitionerId: requesterId,
          external: overrides.external ?? false,
        }),
        encounterId: 'enc-1',
        patientId: 'p1',
      }),
      id,
      ...(overrides.status ? { status: overrides.status } : {}),
    });

    const table = buildOrdersForTrackingBoard({
      encounterIds: ['enc-1'],
      pools: poolTrackingBoardResources([
        dmeOrder('dme-pending'),
        dmeOrder('dme-external', { external: true }),
        dmeOrder('dme-dispensed', { status: 'completed' }),
        dmeOrder('dme-deleted', { status: 'revoked' }),
        requester,
      ]),
      encounters: [enc1],
      appointments: [appt1],
      practitioners: [],
      environment: 'local',
    });

    expect(Object.keys(table.dmeOrdersByEncounterId)).toEqual(['enc-1']);
    const [order] = table.dmeOrdersByEncounterId['enc-1'];
    expect(table.dmeOrdersByEncounterId['enc-1']).toHaveLength(1);
    expect(order.id).toBe('dme-pending');
    expect(order.itemName).toBe('Item dme-pending');
    expect(order.status).toBe(DmeOrderStatus.pending);
    expect(order.orderedBy).toEqual({ practitionerId: requesterId, name: 'Dana Doc' });
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

  const ADULT_DOB = '1990-01-01';
  const heartRate = (id: string, encounterId: string, value: number, interpretation?: string): Observation => ({
    resourceType: 'Observation',
    id,
    status: 'final',
    code: { text: 'Heart rate' },
    encounter: { reference: `Encounter/${encounterId}` },
    performer: [{ reference: 'Practitioner/pr-1' }],
    effectiveDateTime: '2026-09-02T10:00:00Z',
    valueQuantity: { value },
    meta: {
      tag: [
        {
          system: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}`,
          code: VitalFieldNames.VitalHeartbeat,
        },
      ],
    },
    ...(interpretation ? { interpretation: [{ coding: [{ code: interpretation }] }] } : {}),
  });

  const adults = (...ids: string[]): VitalsPatientsByEncounterId =>
    Object.fromEntries(ids.map((id) => [id, { birthDate: ADULT_DOB, gender: 'female' }]));

  const narrowedAdultHeartRateConfig = (): VitalsSchema => {
    const config: VitalsAlertConfig = JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));
    config.thresholds['vital-heartbeat']['18+y'] = {
      criticalLow: 40,
      abnormalLow: 57,
      abnormalHigh: 85,
      criticalHigh: 115,
    };
    return vitalsAlertConfigToVitalsDef(config);
  };

  const defaultConfig = (): VitalsSchema => vitalsAlertConfigToVitalsDef(DEFAULT_VITALS_ALERT_CONFIG);

  test('keeps only encounters with an abnormal reading, which is all the badge renders', () => {
    const vitals = buildVitalsForTrackingBoard({
      observations: [vital('o-1', 'enc-1', true), vital('o-2', 'enc-1', false), vital('o-3', 'enc-2', false)],
      practitioners: [performer],
      patientsByEncounterId: {},
      vitalsAlertConfig: undefined,
    });

    expect(Object.keys(vitals)).toEqual(['enc-1']);
    const temperatures = vitals['enc-1'][VitalFieldNames.VitalTemperature];
    expect(temperatures).toHaveLength(1);
    expect(temperatures[0].resourceId).toBe('o-1');
    expect(temperatures[0].alertCriticality).toBe(VitalAlertCriticality.Critical);
    expect(temperatures[0].authorName).toContain('Ann');
  });

  test('the configured thresholds decide which encounters get a badge', () => {
    const observations = [heartRate('o-1', 'enc-1', 90)];

    expect(
      Object.keys(
        buildVitalsForTrackingBoard({
          observations,
          practitioners: [performer],
          patientsByEncounterId: adults('enc-1'),
          vitalsAlertConfig: defaultConfig(),
        })
      )
    ).toEqual([]);

    expect(
      Object.keys(
        buildVitalsForTrackingBoard({
          observations,
          practitioners: [performer],
          patientsByEncounterId: adults('enc-1'),
          vitalsAlertConfig: narrowedAdultHeartRateConfig(),
        })
      )
    ).toEqual(['enc-1']);
  });

  test('grades abnormal and critical separately, which is what the two badges render', () => {
    const vitals = buildVitalsForTrackingBoard({
      observations: [heartRate('o-1', 'enc-1', 90), heartRate('o-2', 'enc-2', 130)],
      practitioners: [performer],
      patientsByEncounterId: adults('enc-1', 'enc-2'),
      vitalsAlertConfig: narrowedAdultHeartRateConfig(),
    });

    expect(vitals['enc-1'][VitalFieldNames.VitalHeartbeat][0].alertCriticality).toBe(VitalAlertCriticality.Abnormal);
    expect(vitals['enc-2'][VitalFieldNames.VitalHeartbeat][0].alertCriticality).toBe(VitalAlertCriticality.Critical);
  });

  test('the stored interpretation does not override the configured thresholds', () => {
    const vitals = buildVitalsForTrackingBoard({
      observations: [heartRate('o-1', 'enc-1', 70, 'HH')],
      practitioners: [performer],
      patientsByEncounterId: adults('enc-1'),
      vitalsAlertConfig: narrowedAdultHeartRateConfig(),
    });

    expect(Object.keys(vitals)).toEqual([]);
  });

  test('falls back to the stored interpretation when the encounter has no patient', () => {
    const vitals = buildVitalsForTrackingBoard({
      observations: [heartRate('o-1', 'enc-1', 70, 'HX')],
      practitioners: [performer],
      patientsByEncounterId: {},
      vitalsAlertConfig: narrowedAdultHeartRateConfig(),
    });

    expect(vitals['enc-1'][VitalFieldNames.VitalHeartbeat][0].alertCriticality).toBe(VitalAlertCriticality.Abnormal);
  });
});

describe('selectVitalsPatientsByEncounterId', () => {
  const patient: Patient = { resourceType: 'Patient', id: 'p-1', birthDate: '1990-01-01', gender: 'female' };
  const withPatient = (id: string, patientId: string): Appointment => ({
    ...appointment(id),
    participant: [{ actor: { reference: `Patient/${patientId}` }, status: 'accepted' }],
  });

  test('joins through the appointment, since the encounter carries no subject', () => {
    const enc = encounter('enc-1', 'appt-1');
    expect(enc.subject).toBeUndefined();

    expect(
      selectVitalsPatientsByEncounterId({
        appointments: [withPatient('appt-1', 'p-1')],
        apptRefToEncounterMap: { 'Appointment/appt-1': enc },
        patientIdMap: { 'p-1': patient },
      })
    ).toEqual({ 'enc-1': { birthDate: '1990-01-01', gender: 'female' } });
  });

  test('skips an appointment with no patient participant and one whose patient was not returned', () => {
    expect(
      selectVitalsPatientsByEncounterId({
        appointments: [appointment('appt-1'), withPatient('appt-2', 'p-missing')],
        apptRefToEncounterMap: {
          'Appointment/appt-1': encounter('enc-1', 'appt-1'),
          'Appointment/appt-2': encounter('enc-2', 'appt-2'),
        },
        patientIdMap: { 'p-1': patient },
      })
    ).toEqual({});
  });
});

describe('fetchTrackingBoardResources', () => {
  beforeEach(() => {
    vi.mocked(captureException).mockClear();
    vi.mocked(captureMessage).mockClear();
  });

  const searchsetOf = (resources: FhirResource[]): Bundle<FhirResource> => ({
    resourceType: 'Bundle',
    type: 'searchset',
    entry: resources.map((resource) => ({ resource })),
  });
  const batchResponse = (searchsets: Bundle<FhirResource>[]): Bundle<FhirResource> => ({
    resourceType: 'Bundle',
    type: 'batch-response',
    entry: searchsets.map((searchset) => ({ response: { status: '200 OK' }, resource: searchset })),
  });

  type BatchRequest = { requests: { url: string }[] };
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  const encountersIn = (url: string): string[] =>
    (/[?&](?:encounter|context)=([^&]*)/.exec(url)?.[1] ?? '').split(',').map((ref) => ref.replace('Encounter/', ''));
  // A ServiceRequest search answers with one order per encounter it covers; every other family comes back empty.
  const answer = ({ requests }: BatchRequest): Bundle<FhirResource> =>
    batchResponse(
      requests.map(({ url }) =>
        searchsetOf(
          url.startsWith('ServiceRequest?')
            ? encountersIn(url).map((id) => serviceRequest(`sr-${id}`, { encounter: { reference: `Encounter/${id}` } }))
            : []
        )
      )
    );
  const serviceRequestIds = (resources: FhirResource[]): string[] =>
    resources.filter((resource) => resource.resourceType === 'ServiceRequest').map((resource) => resource.id ?? '');
  const hasUrl = (prefix: string) => (request: BatchRequest) =>
    request.requests.some(({ url }) => url.startsWith(prefix));
  // Without DME orders, 100 encounters make 10 searches, sent as two batches of five: the order families of both
  // 50-encounter chunks except the last MedicationRequest, then that MedicationRequest and the four vitals searches.
  const fetchHundred = (oystehr: Oystehr, deadline?: number): ReturnType<typeof fetchTrackingBoardResources> =>
    fetchTrackingBoardResources({ oystehr, encounterIds: encounterIds(100), includeDmeOrders: false, deadline });
  const hundredSearchUrls = (): string[] =>
    buildTrackingBoardSearches(encounterIds(100), false).map((search) => search.url);
  const vitalsBatchUrls = (): string[] => hundredSearchUrls().slice(TRACKING_BOARD_ENTRIES_PER_BATCH);

  test('an oversized batch is retried one search per batch, and the batches that fit are not sent again', async () => {
    // Stand-in for the byte cap: a ServiceRequest search over more than 20 encounters is "too large".
    const sentBatches: string[][] = [];
    const batch = vi.fn(async (request: BatchRequest): Promise<Bundle<FhirResource>> => {
      sentBatches.push(request.requests.map(({ url }) => url));
      if (request.requests.some(({ url }) => url.startsWith('ServiceRequest?') && encountersIn(url).length > 20)) {
        throw sizeCapError();
      }
      return answer(request);
    });
    const oystehr = { fhir: { batch, search: vi.fn() } } as unknown as Oystehr;

    const result = await fetchHundred(oystehr);

    expect(result.failedUrls).toEqual([]);
    expect(serviceRequestIds(result.resources).sort()).toEqual(
      encounterIds(100)
        .map((id) => `sr-${id}`)
        .sort()
    );
    expect(sentBatches.every((urls) => urls.length <= TRACKING_BOARD_ENTRIES_PER_BATCH)).toBe(true);
    // The old retry re-sent every search, the ones that had fit included, as more and larger-fanout batches.
    const sent = sentBatches.flat();
    vitalsBatchUrls().forEach((url) => expect(sent.filter((sentUrl) => sentUrl === url)).toHaveLength(1));
    // Each failed attempt costs a full server-side build of the oversized response, so an oversized batch goes
    // straight to one search per batch: halving it instead would re-send the searches that fit and add a serial
    // failure per level before the too-large search could split its encounters.
    hundredSearchUrls().forEach((url) =>
      expect(sent.filter((sentUrl) => sentUrl === url).length).toBeLessThanOrEqual(2)
    );
  });

  test('a search that cannot shrink below one encounter is reported failed, not retried forever', async () => {
    const batch = vi.fn(async (request: BatchRequest): Promise<Bundle<FhirResource>> => {
      if (hasUrl('ServiceRequest?')(request)) throw sizeCapError();
      return answer(request);
    });
    const oystehr = { fhir: { batch, search: vi.fn() } } as unknown as Oystehr;

    const result = await fetchTrackingBoardResources({ oystehr, encounterIds: encounterIds(2) });

    expect(result.failedUrls.map(encountersIn)).toEqual([['enc-0'], ['enc-1']]);
    expect(result.failedUrls.every((url) => url.startsWith('ServiceRequest?'))).toBe(true);
  });

  test('a batch that fails for another reason is not retried, and the other batches still count', async () => {
    const boom = new Error('boom');
    const batch = vi.fn(async (request: BatchRequest): Promise<Bundle<FhirResource>> => {
      if (hasUrl('Observation?')(request)) throw boom;
      return answer(request);
    });
    const oystehr = { fhir: { batch, search: vi.fn() } } as unknown as Oystehr;

    const result = await fetchHundred(oystehr);

    expect(batch).toHaveBeenCalledTimes(2);
    expect(result.failedUrls).toEqual(vitalsBatchUrls());
    expect(serviceRequestIds(result.resources)).toHaveLength(100);
    // The failure no longer reaches index.ts's catch, so Sentry would never hear of it otherwise.
    expect(captureException).toHaveBeenCalledWith(boom);
  });

  test('a next page that exceeds the size cap is split by encounter, like a first page', async () => {
    // The two-encounter ServiceRequest search has a second page that is too large; each encounter alone fits. The
    // split re-runs the search per encounter from the first page, and the pools dedupe what page one already held.
    const batch = vi.fn(async ({ requests }: BatchRequest): Promise<Bundle<FhirResource>> => {
      if (requests.some(({ url }) => url.includes('_offset='))) throw sizeCapError();
      return batchResponse(
        requests.map(({ url }) => {
          if (!url.startsWith('ServiceRequest?')) return searchsetOf([]);
          const ids = encountersIn(url);
          const orders = ids.map((id) => serviceRequest(`sr-${id}`, { encounter: { reference: `Encounter/${id}` } }));
          return ids.length > 1
            ? { ...searchsetOf(orders.slice(0, 1)), link: [{ relation: 'next', url: 'unused' }] }
            : searchsetOf(orders);
        })
      );
    });
    const oystehr = { fhir: { batch, search: vi.fn() } } as unknown as Oystehr;

    const result = await fetchTrackingBoardResources({ oystehr, encounterIds: encounterIds(2) });

    expect(result.failedUrls).toEqual([]);
    expect(new Set(serviceRequestIds(result.resources))).toEqual(new Set(['sr-enc-0', 'sr-enc-1']));
  });

  test('at the deadline it settles with what arrived and counts the searches still in flight as failed', async () => {
    const batch = vi.fn(
      (request: BatchRequest): Promise<Bundle<FhirResource>> =>
        hasUrl('Observation?')(request) ? new Promise(() => undefined) : Promise.resolve(answer(request))
    );
    const oystehr = { fhir: { batch, search: vi.fn() } } as unknown as Oystehr;

    const result = await fetchHundred(oystehr, Date.now() + 50);

    expect(result.failedUrls).toEqual(vitalsBatchUrls());
    expect(serviceRequestIds(result.resources)).toHaveLength(100);
    // Settling early keeps the Lambda from timing out, which also keeps Sentry's timeout warning from firing.
    expect(captureMessage).toHaveBeenCalledWith(expect.stringContaining('deadline'), 'warning');
  });

  test('past the deadline an oversized batch is not split into new requests', async () => {
    const batch = vi.fn(async (): Promise<Bundle<FhirResource>> => {
      await sleep(30);
      throw sizeCapError();
    });
    const oystehr = { fhir: { batch, search: vi.fn() } } as unknown as Oystehr;

    const result = await fetchTrackingBoardResources({
      oystehr,
      encounterIds: encounterIds(3),
      deadline: Date.now() + 10,
    });
    await sleep(50);

    expect(result.failedUrls).toEqual(buildTrackingBoardSearches(encounterIds(3)).map((search) => search.url));
    expect(batch).toHaveBeenCalledTimes(1);
  });

  test('fetches result-review Tasks directly only for external lab reports that came back without them', async () => {
    const externalLabOrder = serviceRequest('sr-ext', {
      code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '1' }] },
    });
    const inHouseOrder = serviceRequest('sr-ih', {
      code: { coding: [{ system: IN_HOUSE_TEST_CODE_SYSTEM, code: '2' }] },
    });
    const report = (id: string, orderId: string): DiagnosticReport => ({
      resourceType: 'DiagnosticReport',
      id,
      status: 'final',
      code: {},
      basedOn: [{ reference: `ServiceRequest/${orderId}` }],
    });
    const reviewTask = (id: string, reportId: string): Task => ({
      resourceType: 'Task',
      id,
      status: 'ready',
      intent: 'order',
      basedOn: [{ reference: `DiagnosticReport/${reportId}` }],
    });
    const search = vi.fn(async () => ({ unbundle: () => [] }));
    const clientReturning = (resources: FhirResource[]): Oystehr =>
      ({
        fhir: { batch: vi.fn(async () => batchResponse([searchsetOf(resources)])), search },
      }) as unknown as Oystehr;
    const fetchWith = (resources: FhirResource[]): ReturnType<typeof fetchTrackingBoardResources> =>
      fetchTrackingBoardResources({ oystehr: clientReturning(resources), encounterIds: encounterIds(1) });

    // An in-house report never has report-based Tasks: expected, so no extra hop.
    await fetchWith([inHouseOrder, report('dr-ih', 'sr-ih')]);
    expect(search).not.toHaveBeenCalled();

    // An external lab report whose review Task came back in the batch: nothing to fetch.
    await fetchWith([externalLabOrder, report('dr-ext', 'sr-ext'), reviewTask('t-1', 'dr-ext')]);
    expect(search).not.toHaveBeenCalled();

    // An external lab report without one: the fallback Task search runs, for that report only.
    await fetchWith([externalLabOrder, report('dr-ext', 'sr-ext'), inHouseOrder, report('dr-ih', 'sr-ih')]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Task',
        params: [{ name: 'based-on', value: 'DiagnosticReport/dr-ext' }],
      })
    );
  });

  test('past the deadline the direct Task search is not started, and the result is marked incomplete', async () => {
    // The batch lands just as the deadline passes. settleByDeadline stops waiting but cancels nothing, so a search
    // started now would run unawaited through the window reserved for the response.
    vi.useFakeTimers();
    try {
      const deadline = Date.now() + 1_000;
      const externalLabOrder = serviceRequest('sr-ext', {
        code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '1' }] },
      });
      const report: DiagnosticReport = {
        resourceType: 'DiagnosticReport',
        id: 'dr-ext',
        status: 'final',
        code: {},
        basedOn: [{ reference: 'ServiceRequest/sr-ext' }],
      };
      const batch = vi.fn(async (): Promise<Bundle<FhirResource>> => {
        vi.setSystemTime(deadline);
        return batchResponse([searchsetOf([externalLabOrder, report])]);
      });
      const search = vi.fn(async () => ({ unbundle: () => [] }));
      const oystehr = { fhir: { batch, search } } as unknown as Oystehr;

      const result = await fetchTrackingBoardResources({ oystehr, encounterIds: encounterIds(1), deadline });

      expect(search).not.toHaveBeenCalled();
      expect(result.failedUrls).toEqual(['Task?based-on=<external lab DiagnosticReports>']);
    } finally {
      vi.useRealTimers();
    }
  });
});
