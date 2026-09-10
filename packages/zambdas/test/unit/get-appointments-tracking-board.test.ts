import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  Bundle,
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
import { VitalsAlertConfig } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { IN_HOUSE_TEST_CODE_SYSTEM } from 'utils/lib/types/data/in-house/in-house.constants';
import { OYSTEHR_LAB_OI_CODE_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { DEFAULT_VITALS_ALERT_CONFIG, vitalsAlertConfigToVitalsDef } from 'utils/lib/utils/vitals-alert-config';
import { describe, expect, test, vi } from 'vitest';
import {
  buildSearchUrl,
  executeBatchSearches,
  MAX_ENTRIES_PER_BATCH,
  nextPageUrl,
} from '../../src/ehr/get-appointments/batch-search';
import {
  buildOrdersForTrackingBoard,
  buildTrackingBoardSearchUrls,
  buildVitalsForTrackingBoard,
  classifyServiceRequest,
  emptyTrackingBoardExtras,
  fetchTrackingBoardResources,
  partitionServiceRequests,
  poolTrackingBoardResources,
  selectTrackingBoardEncounterIds,
  selectVitalsPatientsByEncounterId,
  VitalsPatientsByEncounterId,
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
    const result = await executeBatchSearches(oystehr, urls, { fhirApiUrl: 'https://fhir.example.com/r4' });

    // 26 entries -> 20 + 6, then one follow-up batch carrying both next pages.
    expect(batchCalls.map((call) => call.length)).toEqual([MAX_ENTRIES_PER_BATCH, 6, 2]);
    // Without `_count` the server's link is followed (made relative); with it the request itself is advanced a page.
    expect(batchCalls[2]).toEqual(['Task?paged=1&_page=2', 'Task?paged=2&_count=1&_offset=1']);
    expect(result.failedUrls).toEqual(['Task?fail=1']);
    // 23 plain + two paged searches with two pages each
    expect(result.resources).toHaveLength(27);
  });
});

describe('tracking board search plan', () => {
  test('one entry per resource family per encounter chunk, with only the includes the mappers read', () => {
    const urls = buildTrackingBoardSearchUrls(encounterIds(120));

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
    expect(serviceRequestUrl).not.toContain('Encounter:appointment');
    expect(serviceRequestUrl).not.toContain('Coverage');
    expect(serviceRequestUrl).not.toContain('Slot');
    expect(serviceRequestUrl).not.toContain('DiagnosticReport:result');

    expect(byType('MedicationAdministration')[0]).toContain(
      '_tag=in-house-medication-administration-order,immunization'
    );
    expect(byType('MedicationRequest')[0]).toContain(`_tag=${ERX_MEDICATION_META_TAG_CODE}`);
  });

  test('no encounters means no entries', () => {
    expect(buildTrackingBoardSearchUrls([])).toHaveLength(0);
    expect(buildTrackingBoardSearchUrls(encounterIds(10))).toHaveLength(4);
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
    expect(Object.keys(extras.orders)).toHaveLength(8);
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

  /** The defaults with adult heart rate narrowed, so 90 bpm becomes abnormal and 130 critical. */
  const narrowedConfig = (): VitalsSchema => {
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
          vitalsAlertConfig: narrowedConfig(),
        })
      )
    ).toEqual(['enc-1']);
  });

  test('grades abnormal and critical separately, which is what the two badges render', () => {
    const vitals = buildVitalsForTrackingBoard({
      observations: [heartRate('o-1', 'enc-1', 90), heartRate('o-2', 'enc-2', 130)],
      practitioners: [performer],
      patientsByEncounterId: adults('enc-1', 'enc-2'),
      vitalsAlertConfig: narrowedConfig(),
    });

    expect(vitals['enc-1'][VitalFieldNames.VitalHeartbeat][0].alertCriticality).toBe(VitalAlertCriticality.Abnormal);
    expect(vitals['enc-2'][VitalFieldNames.VitalHeartbeat][0].alertCriticality).toBe(VitalAlertCriticality.Critical);
  });

  test('the stored interpretation does not override the configured thresholds', () => {
    const vitals = buildVitalsForTrackingBoard({
      observations: [heartRate('o-1', 'enc-1', 70, 'HH')],
      practitioners: [performer],
      patientsByEncounterId: adults('enc-1'),
      vitalsAlertConfig: narrowedConfig(),
    });

    expect(Object.keys(vitals)).toEqual([]);
  });

  test('falls back to the stored interpretation when the encounter has no patient', () => {
    const vitals = buildVitalsForTrackingBoard({
      observations: [heartRate('o-1', 'enc-1', 70, 'HX')],
      practitioners: [performer],
      patientsByEncounterId: {},
      vitalsAlertConfig: narrowedConfig(),
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
  const sizeCapError = (): Error =>
    new Error('Response payload size exceeds the maximum allowed size (6,291,456 bytes)');
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

  test('on a response size error it shrinks the entries per bundle as well as the encounter chunks', async () => {
    // Stand-in for the byte cap: a bundle with more than six entries is "too large".
    const bundleSizes: number[] = [];
    const batch = vi.fn(async ({ requests }: { requests: { url: string }[] }): Promise<Bundle<FhirResource>> => {
      bundleSizes.push(requests.length);
      if (requests.length > 6) throw sizeCapError();
      return batchResponse(requests.map(() => searchsetOf([])));
    });
    const search = vi.fn();
    const oystehr = { fhir: { batch, search } } as unknown as Oystehr;

    const result = await fetchTrackingBoardResources({ oystehr, encounterIds: encounterIds(100) });

    expect(result).toEqual({ resources: [], failedUrls: [] });
    // 100 encounters: 10 entries in one bundle, too large; then 20 entries as two bundles of 10, still too large;
    // then 39 entries as bundles of at most 5. Halving only the encounter chunks would have kept every retry in
    // 20-entry bundles carrying the same bytes.
    expect(bundleSizes.slice(0, 3)).toEqual([10, 10, 10]);
    expect(bundleSizes.slice(3)).toHaveLength(8);
    expect(bundleSizes.slice(3).every((size) => size <= 5)).toBe(true);
    expect(search).not.toHaveBeenCalled();
  });

  test('any other error is not retried', async () => {
    const batch = vi.fn(async (): Promise<Bundle<FhirResource>> => {
      throw new Error('boom');
    });
    const oystehr = { fhir: { batch, search: vi.fn() } } as unknown as Oystehr;

    await expect(fetchTrackingBoardResources({ oystehr, encounterIds: encounterIds(3) })).rejects.toThrow('boom');
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
});
