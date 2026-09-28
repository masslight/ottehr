import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  Condition,
  DiagnosticReport,
  Encounter,
  FhirResource,
  Location,
  MedicationAdministration,
  MedicationStatement,
  Observation,
  Patient,
  PaymentNotice,
  Practitioner,
  ServiceRequest,
} from 'fhir/r4b';
import { FHIR_EXTENSION, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { MEDICATION_CPT_CODES_EXTENSION_URL } from 'utils/lib/fhir/medication-administration';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import {
  DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL,
  SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL,
  SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
} from 'utils/lib/fhir/radiology';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { AdHocBillingOutputSchema } from 'utils/lib/types/adhoc/datasets/billing';
import { AdHocEncountersOutputSchema } from 'utils/lib/types/adhoc/datasets/encounters';
import { AdHocPatientsOutputSchema } from 'utils/lib/types/adhoc/datasets/patients';
import {
  CVX_CODE_SYSTEM_URL,
  MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
  VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
} from 'utils/lib/types/api/medication-administration.constants';
import { CREATED_BY_SYSTEM } from 'utils/lib/types/common';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import {
  PATIENT_BREASTFEEDING_STATUS,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
} from 'utils/lib/types/data/screening-questions/constants';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { fetchAdHocBillingRows } from '../src/shared/adhoc-datasets/billing';
import { fetchAdHocEncounterRows } from '../src/shared/adhoc-datasets/encounters';
import { fetchAdHocPatientRows } from '../src/shared/adhoc-datasets/patients';

// Design requirement: "fixture tests asserting the fetched rows parse against the Zod schema
// (fields present, typed, key resolved values correct) — the same schema the runtime validation
// uses." The fetch+map pipeline runs against a stubbed Oystehr client returning a small FHIR graph;
// the mapped rows must parse with the endpoint's own Output schema — i.e. we validate the ZAMBDA'S
// mapping, not a hand-written response.

// --- FHIR fixtures (one In-Person visit: appointment + encounter + patient + location + provider) --

const appointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'fulfilled',
  start: '2026-07-01T14:00:00.000Z', // a Wednesday
  end: '2026-07-01T14:30:00.000Z',
  description: 'Ear pain',
  appointmentType: { text: 'walk-in' },
  meta: {
    tag: [{ code: OTTEHR_MODULE.IP }, { system: CREATED_BY_SYSTEM, display: 'Staff admin@clinic.com' }],
  },
  participant: [
    { actor: { reference: 'Patient/pat-1' }, status: 'accepted' },
    { actor: { reference: 'Location/loc-1' }, status: 'accepted' },
  ],
};

// Ottehr's visit status is carried on statusHistory via an extension, not by the FHIR status itself.
const visitStatusEntry = (
  status: string,
  start: string,
  end?: string
): NonNullable<Encounter['statusHistory']>[number] => ({
  status: 'in-progress',
  period: { start, ...(end ? { end } : {}) },
  extension: [{ url: FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url, valueCode: status }],
});

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'finished',
  class: { code: 'AMB' },
  appointment: [{ reference: 'Appointment/appt-1' }],
  subject: { reference: 'Patient/pat-1' },
  participant: [
    {
      type: [{ coding: PRACTITIONER_CODINGS.Attender }],
      individual: { reference: 'Practitioner/prac-1' },
      period: { start: '2026-07-01T14:05:00.000Z', end: '2026-07-01T14:25:00.000Z' },
    },
  ],
  // Deliberately includes a BACKWARD move (provider -> intake) so the ordered history is exercised.
  statusHistory: [
    visitStatusEntry('arrived', '2026-07-01T14:00:00.000Z', '2026-07-01T14:05:00.000Z'),
    visitStatusEntry('intake', '2026-07-01T14:05:00.000Z', '2026-07-01T14:10:00.000Z'),
    visitStatusEntry('provider', '2026-07-01T14:10:00.000Z', '2026-07-01T14:20:00.000Z'),
    visitStatusEntry('intake', '2026-07-01T14:20:00.000Z', '2026-07-01T14:25:00.000Z'),
    visitStatusEntry('completed', '2026-07-01T14:25:00.000Z'),
  ],
  diagnosis: [{ condition: { reference: 'Condition/cond-1' }, rank: 1 }],
};

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Jane'], family: 'Doe' }],
  birthDate: '2010-01-01',
  gender: 'female',
  address: [{ city: 'New York', state: 'NY', postalCode: '10001' }],
  telecom: [
    { system: 'phone', value: '555-0100' },
    { system: 'email', value: 'jane@example.com' },
  ],
};

const location: Location = {
  resourceType: 'Location',
  id: 'loc-1',
  name: 'Midtown Clinic',
  address: { state: 'NY' },
  hoursOfOperation: [{ daysOfWeek: ['wed'], openingTime: '08:00:00', closingTime: '18:00:00' }],
};

const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-1',
  name: [{ given: ['Greg'], family: 'House' }],
};

const condition: Condition = {
  resourceType: 'Condition',
  id: 'cond-1',
  subject: { reference: 'Patient/pat-1' },
  code: {
    coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'H66.90', display: 'Otitis media, unspecified' }],
  },
};

// The Appointment search pulls its whole _include/_revinclude graph in one searchset; scoped layer
// searches return that type's fixtures.
// Vitals are charted in Celsius; the dataset converts to °F. The second BP reading has no diastolic
// component, so pair filtering must drop it from BOTH arrays.
// Alert level is written onto the Observation when the vital is charted, against the patient's age
// on that day. The dataset reads it back; it never re-derives thresholds.
const interpretationOf = (code: string): Observation['interpretation'] => [{ coding: [{ code }] }];

const vitalObs = (
  id: string,
  tag: string,
  effectiveDateTime: string,
  value: number,
  unit: string,
  alertCode?: string
): Observation => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { text: tag },
  meta: { tag: [{ code: tag }] },
  encounter: { reference: 'Encounter/enc-1' },
  effectiveDateTime,
  valueQuantity: { value, unit },
  ...(alertCode ? { interpretation: interpretationOf(alertCode) } : {}),
});

// BP carries its alert level per component, not on the parent.
const bpObs = (
  id: string,
  effectiveDateTime: string,
  systolic: number,
  diastolic?: number,
  systolicAlertCode?: string
): Observation => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { text: 'vital-blood-pressure' },
  meta: { tag: [{ code: 'vital-blood-pressure' }] },
  encounter: { reference: 'Encounter/enc-1' },
  effectiveDateTime,
  component: [
    {
      code: { coding: [{ code: '8480-6' }] },
      valueQuantity: { value: systolic, unit: 'mmHg' },
      ...(systolicAlertCode ? { interpretation: interpretationOf(systolicAlertCode) } : {}),
    },
    ...(diastolic == null
      ? []
      : [{ code: { coding: [{ code: '8462-4' }] }, valueQuantity: { value: diastolic, unit: 'mmHg' } }]),
  ],
});

const observations: Observation[] = [
  // Out of chronological order on purpose: the mapping must sort by effectiveDateTime.
  vitalObs('obs-temp-2', 'vital-temperature', '2026-07-01T14:20:00.000Z', 37, 'C'),
  vitalObs('obs-temp-1', 'vital-temperature', '2026-07-01T14:02:00.000Z', 39, 'C', 'HX'),
  vitalObs('obs-hr-1', 'vital-heartbeat', '2026-07-01T14:02:00.000Z', 142, 'beats/min', 'HH'),
  vitalObs('obs-hr-2', 'vital-heartbeat', '2026-07-01T14:20:00.000Z', 96, 'beats/min'),
  // Charted before alert levels were persisted: no interpretation anywhere, so it reads as in range.
  vitalObs('obs-o2-1', 'vital-oxygen-sat', '2026-07-01T14:02:00.000Z', 97, '%'),
  bpObs('obs-bp-1', '2026-07-01T14:02:00.000Z', 118, 76),
  bpObs('obs-bp-2', '2026-07-01T14:20:00.000Z', 122, undefined, 'LX'),
];

const performer = (code: string): NonNullable<MedicationAdministration['performer']>[number] => ({
  actor: { reference: 'Practitioner/prac-1' },
  function: { coding: [{ system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM, code }] },
});
// One vaccine with a VIS date, a vial (lot + expiry) and the full administration detail (codes,
// manufacturer, dose, staff), one partially administered without any of it.
const vaccineAdmin = (
  id: string,
  name: string,
  status: 'completed' | 'on-hold',
  visDate?: string,
  batch?: { lotNumber: string; expirationDate: string },
  withDetail = false
): MedicationAdministration => ({
  resourceType: 'MedicationAdministration' as const,
  id,
  status,
  meta: { tag: [{ code: 'immunization' }] },
  context: { reference: 'Encounter/enc-1' },
  subject: { reference: 'Patient/pat-1' },
  effectiveDateTime: '2026-07-01T14:15:00.000Z',
  ...(withDetail
    ? {
        dosage: {
          dose: { value: 0.5, unit: 'mL', system: 'http://unitsofmeasure.org' },
          route: { coding: [{ system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM, code: 'IM' }] },
        },
        performer: [
          performer(PRACTITIONER_ORDERED_BY_MEDICATION_CODE),
          performer(PRACTITIONER_ADMINISTERED_MEDICATION_CODE),
        ],
      }
    : {}),
  contained: [
    {
      resourceType: 'Medication' as const,
      id: `med-${id}`,
      identifier: [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name }],
      ...(batch ? { batch } : {}),
      ...(withDetail ? { manufacturer: { reference: '#manufacturer-org' } } : {}),
      extension: [
        ...(visDate ? [{ url: VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL, valueDate: visDate }] : []),
        ...(withDetail
          ? [
              { system: CODE_SYSTEM_NDC, code: '49281-0421-88' },
              { system: CVX_CODE_SYSTEM_URL, code: '150' },
              { system: CODE_SYSTEM_CPT, code: '90686' },
            ].map((coding) => ({
              url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
              valueCodeableConcept: { coding: [coding] },
            }))
          : []),
      ],
    },
    ...(withDetail ? [{ resourceType: 'Organization' as const, id: 'manufacturer-org', name: 'Sanofi Pasteur' }] : []),
  ],
});

// In-house administration. The recall attributes live on the CONTAINED Medication copy, and an order
// marked as not administered carries no batch at all — nothing was given, so no vial is tied to the
// patient. `withVial: false` reproduces that. MedicationAdministration.effectiveDateTime is the ORDER
// CREATION time; the instant the drug was given is on the MedicationStatement (partOf → MA) below.
const inHouseAdmin = (
  id: string,
  name: string,
  dose: number,
  effectiveDateTime: string,
  withVial: boolean
): MedicationAdministration => ({
  resourceType: 'MedicationAdministration' as const,
  id,
  status: withVial ? 'completed' : 'not-done',
  meta: { tag: [{ code: MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE }] },
  context: { reference: 'Encounter/enc-1' },
  subject: { reference: 'Patient/pat-1' },
  effectiveDateTime,
  reasonReference: [{ reference: 'Condition/cond-1' }],
  extension: [
    {
      url: MEDICATION_CPT_CODES_EXTENSION_URL,
      valueString: JSON.stringify([{ code: 'J0696', display: 'Ceftriaxone' }]),
    },
  ],
  performer: [
    performer(PRACTITIONER_ORDERED_BY_MEDICATION_CODE),
    ...(withVial ? [performer(PRACTITIONER_ADMINISTERED_MEDICATION_CODE)] : []),
  ],
  dosage: {
    dose: { value: dose, unit: 'mg', system: 'http://unitsofmeasure.org' },
    route: { coding: [{ system: MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM, code: 'IM' }] },
  },
  contained: [
    {
      resourceType: 'Medication' as const,
      id: `med-${id}`,
      identifier: [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name }],
      code: { coding: [{ system: CODE_SYSTEM_NDC, code: '0409-7337-01' }] },
      ...(withVial
        ? {
            manufacturer: { display: 'Acme Pharma' },
            // batch.expirationDate is a FHIR dateTime; the app writes a full instant with an offset.
            batch: { lotNumber: 'LOT-4472', expirationDate: '2027-03-31T00:00:00.000+04:00' },
          }
        : {}),
    },
  ],
});

const administeredStatement: MedicationStatement = {
  resourceType: 'MedicationStatement',
  id: 'ms-3',
  status: 'active',
  meta: { tag: [{ code: 'in-house-medication' }] },
  // No encounter context on the real resource — it is reachable only via partOf → MA.
  partOf: [{ reference: 'MedicationAdministration/ma-3' }],
  subject: { reference: 'Patient/pat-1' },
  effectiveDateTime: '2026-07-01T15:30:00.000Z',
};

// Radiology: an order with its timeline on extensions, a preliminary read and a final read (linked by
// basedOn, not by encounter), plus a still-pending order and a cancelled one.
const radiologyOrder = (
  id: string,
  name: string,
  status: ServiceRequest['status'],
  performedAt?: string
): ServiceRequest => ({
  resourceType: 'ServiceRequest' as const,
  id,
  status,
  intent: 'order',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  meta: { tag: [{ code: 'radiology' }] },
  code: { coding: [{ system: CODE_SYSTEM_CPT, code: '73030', display: name }] },
  extension: [
    { url: SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL, valueDateTime: '2026-07-01T14:12:00.000Z' },
    ...(performedAt ? [{ url: SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL, valueDateTime: performedAt }] : []),
  ],
});
const radiologyRead = (id: string, srId: string, status: DiagnosticReport['status'], at: string): DiagnosticReport => ({
  resourceType: 'DiagnosticReport' as const,
  id,
  status,
  code: { text: 'XR shoulder' },
  basedOn: [{ reference: `ServiceRequest/${srId}` }],
  ...(status === 'preliminary'
    ? { extension: [{ url: DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL, valueDateTime: at }] }
    : { issued: at }),
});
const serviceRequests: FhirResource[] = [
  radiologyOrder('sr-1', 'XR shoulder', 'completed', '2026-07-01T14:30:00.000Z'),
  radiologyRead('dr-1', 'sr-1', 'preliminary', '2026-07-01T14:45:00.000Z'),
  radiologyRead('dr-2', 'sr-1', 'final', '2026-07-01T18:00:00.000Z'),
  radiologyOrder('sr-2', 'XR wrist', 'active'),
  radiologyOrder('sr-3', 'XR knee', 'revoked'),
];

// "Ask the patient" screening answers: chart-data Observations keyed by the config field's fhirField,
// value = the option's fhirValue. Two answers for the same question keep the newest.
const screeningObs = (id: string, field: string, value: string, at: string): Observation => ({
  resourceType: 'Observation' as const,
  id,
  status: 'final',
  code: { text: field },
  meta: { tag: [{ code: field }] },
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  effectiveDateTime: at,
  valueString: value,
});
const screeningObservations: FhirResource[] = [
  screeningObs('obs-scr-1', PATIENT_BREASTFEEDING_STATUS, 'not-applicable', '2026-07-01T14:06:00.000Z'),
  screeningObs('obs-scr-2', SEEN_IN_LAST_THREE_YEARS_FIELD, 'no', '2026-07-01T14:06:00.000Z'),
  screeningObs('obs-scr-3', SEEN_IN_LAST_THREE_YEARS_FIELD, 'yes', '2026-07-01T14:08:00.000Z'),
];

const medicationAdministrations: FhirResource[] = [
  vaccineAdmin(
    'ma-1',
    'Influenza',
    'completed',
    '2026-07-01',
    { lotNumber: 'FLU-2026-A', expirationDate: '2027-01-31' },
    true
  ),
  vaccineAdmin('ma-2', 'MMR', 'on-hold'),
  inHouseAdmin('ma-3', 'Ceftriaxone 1 g', 1000, '2026-07-01T15:00:00.000Z', true),
  inHouseAdmin('ma-4', 'Ceftriaxone 500 mg', 500, '2026-07-01T16:00:00.000Z', false),
];

// Two payments on one visit, out of order, with different methods; one has no method recorded.
const paymentNotice = (id: string, amount: number, created: string, method?: string): PaymentNotice => ({
  resourceType: 'PaymentNotice' as const,
  id,
  status: 'active',
  created,
  request: { reference: 'Encounter/enc-1' },
  payment: {},
  recipient: {},
  amount: { value: amount, currency: 'USD' },
  paymentStatus: { coding: [{ code: 'paid' }] },
  ...(method ? { extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: method }] } : {}),
});

const paymentNotices: FhirResource[] = [
  paymentNotice('pay-2', 25.5, '2026-07-01T18:00:00.000Z', 'cash'),
  paymentNotice('pay-1', 40, '2026-07-01T15:00:00.000Z', 'card'),
  paymentNotice('pay-3', 10, '2026-07-01T19:00:00.000Z'),
];

// The attending provider is not an _include on the main search: it is fetched by id afterwards, so
// the fake serves Practitioner as a scoped type rather than alongside the appointment graph.
const rootResources: FhirResource[] = [appointment, encounter, patient, location];
const scopedByType: Record<string, FhirResource[]> = {
  Practitioner: [practitioner],
  Condition: [condition],
  Observation: [...observations, ...screeningObservations],
  ServiceRequest: serviceRequests,
  // The administration statement arrives as a revinclude of the MA search, never by its own context.
  MedicationAdministration: [...medicationAdministrations, administeredStatement],
  PaymentNotice: paymentNotices,
};
const resourcesFor = (resourceType: string): FhirResource[] =>
  resourceType === 'Appointment' ? rootResources : scopedByType[resourceType] ?? [];

// Emulates the async-bulk path the zambdas use: the job answers with a manifest of file urls, and
// the zambda downloads each file itself — the NDJSON is served by the stubbed fetch below.
const ndjsonByUrl = new Map<string, string>();

const manifestFor = (jobId: string): { output: { type: string; url: string }[]; requiresAccessToken: boolean } => {
  const byType = new Map<string, FhirResource[]>();
  for (const resource of resourcesFor(jobId)) {
    byType.set(resource.resourceType, [...(byType.get(resource.resourceType) ?? []), resource]);
  }
  const output = Array.from(byType.entries()).map(([type, resources]) => {
    const url = `https://example.test/${jobId}/${type}.ndjson`;
    ndjsonByUrl.set(url, resources.map((resource) => JSON.stringify(resource)).join('\n'));
    return { type, url };
  });
  // The manifest asks for a token, which is exactly the case where the SDK's own downloader fails.
  return { output, requiresAccessToken: true };
};

// Stubbed rather than assigned, so vitest restores the real fetch even if a test throws — a leaked
// stub would silently change the behaviour of whatever file runs next in this worker.
vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const url = String(input);
  const ndjson = ndjsonByUrl.get(url);
  if (ndjson === undefined) return { ok: false, status: 404, text: async () => 'not found' };
  return { ok: true, status: 200, text: async () => ndjson };
}) as unknown as typeof fetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

const fakeOystehr = {
  fhir: {
    search: async ({ resourceType }: { resourceType: string }) => ({
      jobId: resourceType,
      contentLocation: '',
      mode: 'bulk',
    }),
    waitForAsyncJob: async (jobId: string) => ({ status: 200, mode: 'bulk', manifest: manifestFor(jobId) }),
  },
  user: { list: async () => [] },
} as unknown as Oystehr;

const dateRange = { start: '2026-07-01T00:00:00.000Z', end: '2026-07-02T00:00:00.000Z' };

// safeParse + issue dump so a schema mismatch fails with the exact zod issues, not just "false".
const issuesOf = (result: { success: boolean; error?: { issues: unknown[] } }): unknown[] =>
  result.success ? [] : result.error?.issues ?? ['unknown'];

describe('ad-hoc dataset zambdas: mapped rows parse against their Zod schema (fixture)', () => {
  it('encounters: base + codes layer rows match the schema with key values resolved', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeCodes: true });

    expect(rows).toHaveLength(1);
    expect(issuesOf(AdHocEncountersOutputSchema.safeParse({ encounters: rows }))).toEqual([]);

    const row = rows[0];
    // Key resolved values — references resolved to display values, closed vocabularies exact.
    expect(row.appointmentId).toBe('appt-1');
    expect(row.visitType).toBe('In-Person');
    expect(row.encounterType).toBe('main');
    expect(row.patientName).toBe('Jane Doe');
    expect(row.attendingProvider).toBe('Greg House');
    expect(row.location).toBe('Midtown Clinic');
    expect(row.registrationChannel).toBe('Staff');
    expect(row.registeredBy).toBe('admin@clinic.com');
    expect(row.scheduledSlotMinutes).toBe(30);
    expect(row.clinicOpenHours).toBe(10);
    // codes layer, resolved through the Condition fetch:
    expect(row.icdCodes).toEqual(['H66.90']);
    expect(row.primaryIcd).toBe('H66.90');
    expect(row.primaryIcdDisplay).toBe('Otitis media, unspecified');
    // statusHistory is a BASE field: ordered oldest-first, so a backward move is detectable.
    expect(row.statusHistory.map((e) => e.status)).toEqual(['arrived', 'intake', 'provider', 'intake', 'completed']);
    expect(row.statusHistory[0].start).toBe('2026-07-01T14:00:00.000Z');
    expect(row.statusHistory.at(-1)?.end).toBeNull();
    // The current status began when the last history entry started.
    expect(row.visitStatusSince).toBe('2026-07-01T14:25:00.000Z');
    // Reason for visit is the booking's free text, never the booking kind (walk-in / pre-book).
    expect(row.reason).toBe('Ear pain');
  });

  it('encounters vitals layer: readings are chronological, °C converted to °F, BP pairs aligned', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeVitals: true });
    const row = rows[0];

    expect(issuesOf(AdHocEncountersOutputSchema.safeParse({ encounters: rows }))).toEqual([]);

    // Charted 39 °C then 37 °C (out of order in the fixture) -> °F, oldest first.
    expect(row.temperatureFReadings).toEqual([102.2, 98.6]);
    expect(row.temperatureF).toBe(98.6); // scalar stays the MOST RECENT value
    // [0] is the initial screening value, length is how many times it was taken.
    expect(row.heartRateReadings).toEqual([142, 96]);
    expect(row.heartRateReadings?.[0]).toBe(142);
    expect(row.heartRateReadings).toHaveLength(2);
    expect(row.heartRate).toBe(96);
    // The second BP reading has no diastolic component, so it is dropped from BOTH arrays.
    expect(row.systolicBPReadings).toEqual([118]);
    expect(row.diastolicBPReadings).toEqual([76]);
    expect(row.systolicBPReadings?.length).toBe(row.diastolicBPReadings?.length);
  });

  it('encounters vitals layer: alert levels come from the charted interpretation', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeVitals: true });
    const row = rows[0];

    // Temperature was abnormal on the FIRST reading only, heart rate was critical, BP was abnormal on
    // a component. Oxygen saturation has no interpretation, so it counts as in range.
    expect(row.abnormalVitals?.slice().sort()).toEqual(['bloodPressure', 'heartRate', 'temperatureF']);
    expect(row.criticalVitals).toEqual(['heartRate']);
    // A reading dropped from the paired arrays still counts towards the alert.
    expect(row.abnormalVitals).toContain('bloodPressure');
  });

  it('encounters imaging layer: one study record per radiology order with its status timeline', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeImaging: true });
    const row = rows[0];

    expect(issuesOf(AdHocEncountersOutputSchema.safeParse({ encounters: rows }))).toEqual([]);
    // The flat list keeps excluding cancelled orders; the records carry every order with a status.
    expect(row.imagingOrders).toEqual(['XR shoulder', 'XR wrist']);
    expect(row.imagingStudies).toEqual([
      {
        name: 'XR shoulder',
        status: 'final',
        orderedAt: '2026-07-01T14:12:00.000Z',
        performedAt: '2026-07-01T14:30:00.000Z',
        preliminaryAt: '2026-07-01T14:45:00.000Z',
        finalAt: '2026-07-01T18:00:00.000Z',
      },
      {
        name: 'XR wrist',
        status: 'pending',
        orderedAt: '2026-07-01T14:12:00.000Z',
        performedAt: null,
        preliminaryAt: null,
        finalAt: null,
      },
      {
        name: 'XR knee',
        status: 'cancelled',
        orderedAt: '2026-07-01T14:12:00.000Z',
        performedAt: null,
        preliminaryAt: null,
        finalAt: null,
      },
    ]);
  });

  it('encounters intake layer: screening answers resolved to question text and option label, newest wins', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeIntake: true });
    const row = rows[0];

    expect(issuesOf(AdHocEncountersOutputSchema.safeParse({ encounters: rows }))).toEqual([]);
    expect(row.screeningAnswers).toEqual([
      { question: 'Has the patient been seen in one of our offices / telemed in last 3 years?', answer: 'Yes' },
      { question: 'Are you currently breastfeeding?', answer: 'Not applicable' },
    ]);
    expect(row.screeningQuestions).toEqual([
      'Has the patient been seen in one of our offices / telemed in last 3 years?',
      'Are you currently breastfeeding?',
    ]);
  });

  it('encounters immunizations layer: one vaccine record each, VIS presence carried by the date', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeImmunizations: true });
    const row = rows[0];

    expect(issuesOf(AdHocEncountersOutputSchema.safeParse({ encounters: rows }))).toEqual([]);
    const noDetail = {
      ndc: null,
      cvx: null,
      manufacturer: null,
      dose: null,
      units: null,
      route: null,
      administeredAt: '2026-07-01T14:15:00.000Z',
      administeredBy: null,
      orderedBy: null,
      cptCodes: [],
    };
    expect(row.vaccines).toEqual([
      {
        name: 'Influenza',
        status: 'administered',
        visDate: '2026-07-01',
        lotNumber: 'FLU-2026-A',
        expirationDate: '2027-01-31',
        ndc: '49281-0421-88',
        cvx: '150',
        manufacturer: 'Sanofi Pasteur',
        dose: 0.5,
        units: 'mL',
        route: 'IM',
        administeredAt: '2026-07-01T14:15:00.000Z',
        administeredBy: 'Greg House',
        orderedBy: 'Greg House',
        cptCodes: ['90686'],
      },
      {
        name: 'MMR',
        status: 'partially-administered',
        visDate: null,
        lotNumber: null,
        expirationDate: null,
        ...noDetail,
      },
    ]);
  });

  it('encounters medications layer: one record per drug carrying the recall attributes', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeMedications: true });
    const row = rows[0];

    expect(issuesOf(AdHocEncountersOutputSchema.safeParse({ encounters: rows }))).toEqual([]);
    // Immunization administrations belong to the vaccines field, not here.
    expect(row.drugs?.map((d) => d.name)).toEqual(['Ceftriaxone 1 g', 'Ceftriaxone 500 mg']);

    const given = row.drugs?.find((d) => d.name === 'Ceftriaxone 1 g');
    expect(given).toEqual({
      name: 'Ceftriaxone 1 g',
      source: 'in-house',
      status: 'administered',
      dose: 1000,
      units: 'mg',
      route: 'IM',
      ndc: '0409-7337-01',
      lotNumber: 'LOT-4472',
      // Kept as the calendar date that was entered — a zone conversion would report the 30th.
      expirationDate: '2027-03-31',
      manufacturer: 'Acme Pharma',
      // The time the drug was given (MedicationStatement), NOT the order creation time on the MA.
      administeredAt: '2026-07-01T15:30:00.000Z',
      administeredBy: 'Greg House',
      orderedBy: 'Greg House',
      cptCodes: ['J0696'],
      icdCode: 'H66.90',
      icdDisplay: 'Otitis media, unspecified',
    });

    // Marked as not administered: no vial is tied to the patient, so no lot, expiry or manufacturer.
    const notGiven = row.drugs?.find((d) => d.name === 'Ceftriaxone 500 mg');
    expect(notGiven?.status).toBe('not-administered');
    expect(notGiven?.administeredAt).toBeNull();
    expect(notGiven?.administeredBy).toBeNull();
    expect(notGiven?.lotNumber).toBeNull();
    expect(notGiven?.expirationDate).toBeNull();
    expect(notGiven?.manufacturer).toBeNull();
    // The dose was still charted, and the NDC belongs to the catalogue entry rather than the vial.
    expect(notGiven?.dose).toBe(500);
    expect(notGiven?.ndc).toBe('0409-7337-01');

    // The flat arrays stay in step with the records — they are what value sampling shows the model.
    expect(row.medications).toEqual(['Ceftriaxone 1 g', 'Ceftriaxone 500 mg']);
    expect(row.medicationCount).toBe(2);
  });

  it('billing: base rows match the schema; layer columns stay absent when not requested', async () => {
    const rows = await fetchAdHocBillingRows(fakeOystehr, { dateRange });

    expect(rows).toHaveLength(1);
    expect(issuesOf(AdHocBillingOutputSchema.safeParse({ rows }))).toEqual([]);

    const row = rows[0];
    expect(row.visitType).toBe('In-Person');
    expect(row.patientName).toBe('Jane Doe');
    expect(row.attendingProvider).toBe('Greg House');
    // Opt-in layer fields must be ABSENT (not null/garbage) when the layer wasn't requested.
    expect('paymentsCollected' in row).toBe(false);
    expect('payerType' in row).toBe(false);
  });

  it('billing payments layer: one record per payment, oldest first, aggregates in step', async () => {
    const rows = await fetchAdHocBillingRows(fakeOystehr, { dateRange, includePayments: true });
    const row = rows[0];

    expect(issuesOf(AdHocBillingOutputSchema.safeParse({ rows }))).toEqual([]);
    // Charted out of order in the fixture; the records come back oldest first.
    expect(row.payments).toEqual([
      { date: '2026-07-01T15:00:00.000Z', amount: 40, method: 'card' },
      { date: '2026-07-01T18:00:00.000Z', amount: 25.5, method: 'cash' },
      { date: '2026-07-01T19:00:00.000Z', amount: 10, method: '' },
    ]);
    // The aggregates must agree with the records, or a report mixing both contradicts itself.
    expect(row.paymentsCollected).toBe(75.5);
    expect(row.paymentCount).toBe(3);
    expect(row.lastPaymentDate).toBe('2026-07-01T19:00:00.000Z');
    expect(row.payments?.reduce((sum, p) => sum + p.amount, 0)).toBe(row.paymentsCollected);
  });

  it('patients: per-patient rollup rows match the schema', async () => {
    const rows = await fetchAdHocPatientRows(fakeOystehr, { dateRange });

    expect(rows).toHaveLength(1);
    expect(issuesOf(AdHocPatientsOutputSchema.safeParse({ patients: rows }))).toEqual([]);

    const row = rows[0];
    expect(row.patientId).toBe('pat-1');
    expect(row.patientName).toBe('Jane Doe');
    expect(row.totalVisits).toBe(1);
    expect(row.visitTypes).toEqual(['In-Person']);
    expect(row.locations).toEqual(['Midtown Clinic']);
  });
});
