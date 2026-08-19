import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  Condition,
  Encounter,
  FhirResource,
  Location,
  MedicationAdministration,
  Observation,
  Patient,
  Practitioner,
} from 'fhir/r4b';
import { FHIR_EXTENSION } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { AdHocBillingOutputSchema } from 'utils/lib/types/adhoc/datasets/billing';
import { AdHocEncountersOutputSchema } from 'utils/lib/types/adhoc/datasets/encounters';
import { AdHocPatientsOutputSchema } from 'utils/lib/types/adhoc/datasets/patients';
import { VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL } from 'utils/lib/types/api/medication-administration.constants';
import { CREATED_BY_SYSTEM } from 'utils/lib/types/common';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { describe, expect, it } from 'vitest';
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

// One vaccine with a VIS date, one administered without it (the compliance gap).
const vaccineAdmin = (
  id: string,
  name: string,
  status: 'completed' | 'on-hold',
  visDate?: string
): MedicationAdministration => ({
  resourceType: 'MedicationAdministration' as const,
  id,
  status,
  meta: { tag: [{ code: 'immunization' }] },
  context: { reference: 'Encounter/enc-1' },
  subject: { reference: 'Patient/pat-1' },
  effectiveDateTime: '2026-07-01T14:15:00.000Z',
  contained: [
    {
      resourceType: 'Medication' as const,
      id: `med-${id}`,
      identifier: [{ system: 'https://fhir.ottehr.com/Identifier/medication-name', value: name }],
      ...(visDate ? { extension: [{ url: VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL, valueDate: visDate }] } : {}),
    },
  ],
});

const medicationAdministrations: FhirResource[] = [
  vaccineAdmin('ma-1', 'Influenza', 'completed', '2026-07-01'),
  vaccineAdmin('ma-2', 'MMR', 'on-hold'),
];

const rootResources: FhirResource[] = [appointment, encounter, patient, location, practitioner];
const scopedByType: Record<string, FhirResource[]> = {
  Condition: [condition],
  Observation: observations,
  MedicationAdministration: medicationAdministrations,
};
const resourcesFor = (resourceType: string): FhirResource[] =>
  resourceType === 'Appointment' ? rootResources : scopedByType[resourceType] ?? [];

// Emulates the async-bundle path the zambdas use: search returns a job handle (jobId encodes the
// resource type and the requested offset), and waitForAsyncJob returns the completion bundle
// (batch-response) whose first entry holds the searchset. The fixtures all fit on the first page,
// so a non-zero offset returns an empty page — matching how searchAllAsync terminates.
const fakeOystehr = {
  fhir: {
    search: async ({ resourceType, params }: { resourceType: string; params?: { name: string; value: string }[] }) => ({
      jobId: `${resourceType}#${params?.find((p) => p.name === '_offset')?.value ?? '0'}`,
      contentLocation: '',
      mode: 'bundle',
    }),
    waitForAsyncJob: async (jobId: string) => {
      const [resourceType, offset] = jobId.split('#');
      const resources = Number(offset) === 0 ? resourcesFor(resourceType) : [];
      return {
        status: 200,
        mode: 'bundle',
        bundle: {
          resourceType: 'Bundle',
          type: 'batch-response',
          entry: [
            {
              resource: {
                resourceType: 'Bundle',
                type: 'searchset',
                entry: resources.map((resource) => ({ resource })),
              },
            },
          ],
        },
      };
    },
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

  it('encounters immunizations layer: one vaccine record each, VIS presence carried by the date', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeImmunizations: true });
    const row = rows[0];

    expect(issuesOf(AdHocEncountersOutputSchema.safeParse({ encounters: rows }))).toEqual([]);
    expect(row.vaccines).toEqual([
      { name: 'Influenza', status: 'administered', visDate: '2026-07-01' },
      { name: 'MMR', status: 'partially-administered', visDate: null },
    ]);
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
