import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource, Location, Organization, Patient, Practitioner } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { AdHocPatientsOutputSchema } from 'utils/lib/types/adhoc/datasets/patients';
import { PRACTICE_NAME_URL } from 'utils/lib/types/constants';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { PATIENT_CONTAINED_PHARMACY_ID } from '../src/ehr/shared/harvest';
import { fetchAdHocPatientRows } from '../src/shared/adhoc-datasets/patients';

// Fixture tests for the Patients layers that reuse app logic: the Recent Patients report's new-vs-existing
// rule and the visit details face sheet's demographics / PCP / pharmacy composers.

const appointment = (id: string, patientId: string): Appointment => ({
  resourceType: 'Appointment',
  id,
  status: 'fulfilled',
  start: '2026-07-01T14:00:00.000Z',
  meta: { tag: [{ code: OTTEHR_MODULE.IP }] },
  participant: [
    { actor: { reference: `Patient/${patientId}` }, status: 'accepted' },
    { actor: { reference: 'Location/loc-1' }, status: 'accepted' },
  ],
});

const encounter = (id: string, appointmentId: string, patientId: string): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { code: 'AMB' },
  appointment: [{ reference: `Appointment/${appointmentId}` }],
  subject: { reference: `Patient/${patientId}` },
});

const codeable = (display: string): { coding: { display: string }[] } => ({ coding: [{ display }] });

const returningPatient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Jane'], family: 'Doe' }],
  birthDate: '2010-01-01',
  gender: 'female',
  communication: [{ language: { coding: [{ code: 'es', display: 'Spanish' }] }, preferred: true }],
  extension: [
    { url: `${PRIVATE_EXTENSION_BASE_URL}/race`, valueCodeableConcept: codeable('Asian') },
    { url: `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`, valueCodeableConcept: codeable('Not Hispanic or Latino') },
    { url: `${PRIVATE_EXTENSION_BASE_URL}/send-marketing`, valueBoolean: true },
  ],
  contained: [
    {
      resourceType: 'Practitioner',
      id: 'primary-care-physician',
      active: true,
      name: [{ given: ['Paul'], family: 'Care' }],
      extension: [{ url: PRACTICE_NAME_URL, valueString: 'Family Practice' }],
    } as Practitioner,
    { resourceType: 'Organization', id: PATIENT_CONTAINED_PHARMACY_ID, name: 'Main St Pharmacy' } as Organization,
  ],
};

const newPatient: Patient = {
  resourceType: 'Patient',
  id: 'pat-2',
  name: [{ given: ['John'], family: 'Roe' }],
  deceasedBoolean: true,
};

const location: Location = { resourceType: 'Location', id: 'loc-1', name: 'Midtown Clinic' };

// Only pat-1 was seen before the range.
const priorAppointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appt-old',
  status: 'cancelled',
  start: '2025-03-10T10:00:00.000Z',
  participant: [{ actor: { reference: 'Patient/pat-1' }, status: 'accepted' }],
};

const resourcesByJob: Record<string, FhirResource[]> = {
  Appointment: [
    appointment('appt-1', 'pat-1'),
    appointment('appt-2', 'pat-2'),
    encounter('enc-1', 'appt-1', 'pat-1'),
    encounter('enc-2', 'appt-2', 'pat-2'),
    returningPatient,
    newPatient,
    location,
  ],
  'Appointment:prior': [priorAppointment],
};

const jobIdFor = (resourceType: string, params: { name: string; value: string }[]): string =>
  resourceType === 'Appointment' && params.some((p) => p.name === 'patient') ? 'Appointment:prior' : resourceType;

const ndjsonByUrl = new Map<string, string>();
const manifestFor = (jobId: string): { output: { type: string; url: string }[]; requiresAccessToken: boolean } => {
  const url = `https://example.test/${jobId}.ndjson`;
  ndjsonByUrl.set(url, (resourcesByJob[jobId] ?? []).map((resource) => JSON.stringify(resource)).join('\n'));
  return { output: [{ type: jobId, url }], requiresAccessToken: true };
};

vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const ndjson = ndjsonByUrl.get(String(input));
  if (ndjson === undefined) return { ok: false, status: 404, text: async () => 'not found' };
  return { ok: true, status: 200, text: async () => ndjson };
}) as unknown as typeof fetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

const fakeOystehr = {
  fhir: {
    search: async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => ({
      jobId: jobIdFor(resourceType, params ?? []),
      contentLocation: '',
      mode: 'bulk',
    }),
    waitForAsyncJob: async (jobId: string) => ({ status: 200, mode: 'bulk', manifest: manifestFor(jobId) }),
  },
  user: { list: async () => [] },
} as unknown as Oystehr;

const dateRange = { start: '2026-07-01T00:00:00.000Z', end: '2026-07-02T00:00:00.000Z' };

const issuesOf = (result: { success: boolean; error?: { issues: unknown[] } }): unknown[] =>
  result.success ? [] : result.error?.issues ?? ['unknown'];

describe('ad-hoc Patients: layers mapped with the app logic (fixture)', () => {
  it('rows parse against the schema', async () => {
    const rows = await fetchAdHocPatientRows(fakeOystehr, {
      dateRange,
      includeVisitHistory: true,
      includeDemographics: true,
    });
    expect(rows).toHaveLength(2);
    expect(issuesOf(AdHocPatientsOutputSchema.safeParse({ patients: rows }))).toEqual([]);
  });

  it('visit history: new vs existing by any appointment before the range', async () => {
    const rows = await fetchAdHocPatientRows(fakeOystehr, { dateRange, includeVisitHistory: true });
    const returning = rows.find((r) => r.patientId === 'pat-1')!;
    const fresh = rows.find((r) => r.patientId === 'pat-2')!;
    expect(returning.patientStatus).toBe('existing');
    expect(returning.lastAppointmentBeforeRange).toBe('2025-03-10T10:00:00.000Z');
    expect(fresh.patientStatus).toBe('new');
    expect(fresh.lastAppointmentBeforeRange).toBeNull();
  });

  it('demographics: face-sheet details, PCP and pharmacy', async () => {
    const rows = await fetchAdHocPatientRows(fakeOystehr, { dateRange, includeDemographics: true });
    const returning = rows.find((r) => r.patientId === 'pat-1')!;
    expect(returning).toMatchObject({
      preferredLanguage: 'Spanish',
      race: 'Asian',
      ethnicity: 'Not Hispanic or Latino',
      marketingOptIn: true,
      hasPcp: true,
      pcpPracticeName: 'Family Practice',
      preferredPharmacy: 'Main St Pharmacy',
      deceased: false,
    });
    expect(returning.pcpName).toContain('Care');

    const fresh = rows.find((r) => r.patientId === 'pat-2')!;
    expect(fresh).toMatchObject({ preferredLanguage: '', hasPcp: false, preferredPharmacy: '', deceased: true });
  });
});
