import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource, Location, Organization, Patient, Practitioner } from 'fhir/r4b';
import {
  FHIR_EXTENSION,
  OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
  PATIENT_BILLING_ACCOUNT_TYPE,
  PRIVATE_EXTENSION_BASE_URL,
} from 'utils/lib/fhir/constants';
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

// A record merged away into pat-1 (merge-patients: active=false + replaced-by link).
const newPatient: Patient = {
  resourceType: 'Patient',
  id: 'pat-2',
  name: [{ given: ['John'], family: 'Roe' }],
  deceasedBoolean: true,
  active: false,
  link: [{ other: { reference: 'Patient/pat-1' }, type: 'replaced-by' }],
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

// pat-1's chart lists, tagged the way chart-data writes them. The untagged Condition is a visit diagnosis,
// not a problem-list entry, and must stay out.
const tag = (code: string): { meta: { tag: { code: string }[] } } => ({ meta: { tag: [{ code }] } });

const chartResources: FhirResource[] = [
  {
    resourceType: 'AllergyIntolerance',
    id: 'al-1',
    patient: { reference: 'Patient/pat-1' },
    code: { coding: [{ code: '7980', display: 'Penicillin' }] },
    clinicalStatus: { coding: [{ code: 'active' }] },
    ...tag('known-allergy'),
  },
  {
    resourceType: 'AllergyIntolerance',
    id: 'al-2',
    patient: { reference: 'Patient/pat-1' },
    code: { coding: [{ code: '1191', display: 'Aspirin' }] },
    clinicalStatus: { coding: [{ code: 'inactive' }] },
    ...tag('known-allergy'),
  },
  {
    resourceType: 'Condition',
    id: 'pl-1',
    subject: { reference: 'Patient/pat-1' },
    code: { coding: [{ code: 'J45.909', display: 'Asthma' }] },
    clinicalStatus: { coding: [{ code: 'active' }] },
    ...tag('medical-condition'),
  },
  {
    resourceType: 'Condition',
    id: 'dx-1',
    subject: { reference: 'Patient/pat-1' },
    code: { coding: [{ code: 'J02.9', display: 'Acute pharyngitis' }] },
  },
  {
    resourceType: 'MedicationStatement',
    id: 'ms-1',
    status: 'active',
    subject: { reference: 'Patient/pat-1' },
    medicationCodeableConcept: { coding: [{ code: '745679', display: 'Albuterol inhaler' }] },
    dosage: [{ text: '2 puffs', asNeededBoolean: true }],
    effectiveDateTime: '2026-06-30T08:00:00.000Z',
    ...tag('current-medication'),
  },
  {
    resourceType: 'Procedure',
    id: 'sh-1',
    status: 'completed',
    subject: { reference: 'Patient/pat-1' },
    code: { coding: [{ code: '44950', display: 'Appendectomy' }] },
    ...tag('surgical-history'),
  },
  {
    resourceType: 'EpisodeOfCare',
    id: 'eoc-1',
    status: 'finished',
    patient: { reference: 'Patient/pat-1' },
    type: [{ text: 'Pneumonia' }],
    ...tag('hospitalization'),
  },
] as FhirResource[];

// pat-1's account picture, shaped as the patient-account harvest writes it: a billing Account with a contained
// guarantor (a parent) and the primary Coverage, an occupational-medicine Account owned by the employer, the
// payer Organization and an emergency contact.
const orgType = (code: string): Organization['type'] => [
  { coding: [{ system: FHIR_EXTENSION.Organization.organizationType.url, code }] },
];

const accountResources: FhirResource[] = [
  {
    resourceType: 'Account',
    id: 'acct-1',
    status: 'active',
    type: PATIENT_BILLING_ACCOUNT_TYPE,
    subject: [{ reference: 'Patient/pat-1' }],
    guarantor: [{ party: { reference: '#rp-guarantor' } }],
    coverage: [{ coverage: { reference: 'Coverage/cov-1' }, priority: 1 }],
    contained: [
      {
        resourceType: 'RelatedPerson',
        id: 'rp-guarantor',
        patient: { reference: 'Patient/pat-1' },
        name: [{ given: ['Mary'], family: 'Doe' }],
        relationship: [{ coding: [{ code: 'parent', display: 'Parent' }] }],
      },
    ],
  },
  {
    resourceType: 'Account',
    id: 'acct-om',
    status: 'active',
    type: OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
    subject: [{ reference: 'Patient/pat-1' }],
    owner: { reference: 'Organization/emp-1' },
  },
  {
    resourceType: 'Coverage',
    id: 'cov-1',
    status: 'active',
    order: 1,
    beneficiary: { reference: 'Patient/pat-1' },
    payor: [{ reference: 'Organization/payer-1' }],
    class: [{ type: { coding: [{ code: 'plan' }] }, value: '60054' }],
    identifier: [
      { type: { coding: [{ code: 'MB' }] }, value: 'MEM-123', assigner: { reference: 'Organization/payer-1' } },
    ],
    relationship: { coding: [{ code: 'child', display: 'Child' }] },
  },
  {
    resourceType: 'Organization',
    id: 'payer-1',
    name: 'Aetna',
    type: orgType('pay'),
    identifier: [{ system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id', value: '60054' }],
  },
  {
    resourceType: 'Organization',
    id: 'emp-1',
    name: 'Acme Corp',
    type: orgType('occupational-medicine-employer'),
  },
  {
    resourceType: 'RelatedPerson',
    id: 'ec-1',
    patient: { reference: 'Patient/pat-1' },
    name: [{ given: ['Tom'], family: 'Doe' }],
    relationship: [
      { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'EP', display: 'Spouse' }] },
    ],
  },
] as FhirResource[];

const resourcesByJob: Record<string, FhirResource[]> = {
  Patient: [returningPatient, newPatient, ...accountResources],
  Appointment: [
    appointment('appt-1', 'pat-1'),
    appointment('appt-2', 'pat-2'),
    encounter('enc-1', 'appt-1', 'pat-1'),
    encounter('enc-2', 'appt-2', 'pat-2'),
    returningPatient,
    newPatient,
    location,
    ...chartResources,
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
  it('contacts, insurance and employers: the patient-account picture through the face-sheet composers', async () => {
    const rows = await fetchAdHocPatientRows(fakeOystehr, {
      dateRange,
      includeContacts: true,
      includeInsurance: true,
      includeEmployers: true,
    });
    expect(issuesOf(AdHocPatientsOutputSchema.safeParse({ patients: rows }))).toEqual([]);
    expect(rows.find((r) => r.patientId === 'pat-1')).toMatchObject({
      responsiblePartyRelationship: 'Parent',
      responsiblePartyName: 'Mary Doe',
      emergencyContactRelationship: 'Spouse',
      emergencyContactName: 'Tom Doe',
      insured: true,
      primaryInsuranceCarrier: 'Aetna',
      primaryMemberId: 'MEM-123',
      primaryRelationshipToInsured: 'Child',
      secondaryInsuranceCarrier: '',
      occupationalMedicineEmployer: 'Acme Corp',
      workersCompEmployer: '',
    });
    expect(rows.find((r) => r.patientId === 'pat-2')).toMatchObject({
      responsiblePartyRelationship: '',
      insured: false,
      primaryInsuranceCarrier: '',
      occupationalMedicineEmployer: '',
    });
  });

  it('chart lists: built by the chart mapper, with current / history status', async () => {
    const rows = await fetchAdHocPatientRows(fakeOystehr, {
      dateRange,
      includeAllergies: true,
      includeProblems: true,
      includeMedications: true,
      includeSurgicalHistory: true,
      includeHospitalizations: true,
    });
    expect(issuesOf(AdHocPatientsOutputSchema.safeParse({ patients: rows }))).toEqual([]);
    const row = rows.find((r) => r.patientId === 'pat-1')!;
    expect(row.allergies).toEqual(['Penicillin', 'Aspirin']);
    expect(row.allergyDetails).toEqual([
      { name: 'Penicillin', current: true },
      { name: 'Aspirin', current: false },
    ]);
    expect(row.problems).toEqual(['Asthma']);
    expect(row.problemCodes).toEqual(['J45.909']);
    expect(row.problemDetails).toEqual([{ display: 'Asthma', code: 'J45.909', current: true }]);
    expect(row.currentMedications).toEqual(['Albuterol inhaler']);
    expect(row.currentMedicationDetails).toMatchObject([
      { name: 'Albuterol inhaler', type: 'as-needed', status: 'active', lastTakenAt: '2026-06-30T08:00:00.000Z' },
    ]);
    expect(row.surgicalHistory).toEqual(['Appendectomy']);
    expect(row.surgicalHistoryCodes).toEqual(['44950']);
    expect(row.hospitalizations).toEqual(['Pneumonia']);

    const other = rows.find((r) => r.patientId === 'pat-2')!;
    expect(other).toMatchObject({ allergies: [], problemCount: 0, currentMedicationCount: 0, surgicalHistory: [] });
  });

  it('rows parse against the schema', async () => {
    const rows = await fetchAdHocPatientRows(fakeOystehr, {
      dateRange,
      includeVisitHistory: true,
      includeDemographics: true,
    });
    expect(rows).toHaveLength(2);
    expect(issuesOf(AdHocPatientsOutputSchema.safeParse({ patients: rows }))).toEqual([]);
  });

  it('base: active and merged-away records', async () => {
    const rows = await fetchAdHocPatientRows(fakeOystehr, { dateRange });
    expect(rows.find((r) => r.patientId === 'pat-1')).toMatchObject({ active: true, mergedIntoPatientId: null });
    expect(rows.find((r) => r.patientId === 'pat-2')).toMatchObject({ active: false, mergedIntoPatientId: 'pat-1' });
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
