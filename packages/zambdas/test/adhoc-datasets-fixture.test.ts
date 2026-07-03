import Oystehr from '@oystehr/sdk';
import { Appointment, Condition, Encounter, FhirResource, Location, Patient, Practitioner } from 'fhir/r4b';
import {
  AdHocBillingOutputSchema,
  AdHocEncountersOutputSchema,
  AdHocPatientsOutputSchema,
  CREATED_BY_SYSTEM,
  OTTEHR_MODULE,
  PRACTITIONER_CODINGS,
} from 'utils';
import { describe, expect, it } from 'vitest';
import { fetchAdHocBillingRows } from '../src/ehr/adhoc-billing/index';
import { fetchAdHocEncounterRows } from '../src/ehr/adhoc-encounters/index';
import { fetchAdHocPatientRows } from '../src/ehr/adhoc-patients/index';

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

// What the root Appointment search returns (the _include/_revinclude graph rides along in one bundle).
const rootResources: FhirResource[] = [appointment, encounter, patient, location, practitioner];

// Scoped layer searches, keyed by resourceType; anything not listed returns empty.
const scopedByType: Record<string, FhirResource[]> = {
  Condition: [condition],
};

const bundleOf = (resources: FhirResource[]): unknown => ({ unbundle: () => resources, link: [] });

const fakeOystehr = {
  fhir: {
    search: async ({ resourceType }: { resourceType: string }) =>
      resourceType === 'Appointment' ? bundleOf(rootResources) : bundleOf(scopedByType[resourceType] ?? []),
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
