import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  Communication,
  Encounter,
  FhirResource,
  Location,
  Organization,
  Patient,
  Practitioner,
} from 'fhir/r4b';
import {
  ATTORNEY_FIRM_EXTENSION_URL,
  CPT_CODE_SYSTEM,
  CPT_MODIFIER_EXTENSION_URL,
  ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL,
  FHIR_EXTENSION,
  OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
  PATIENT_BILLING_ACCOUNT_TYPE,
  PRIVATE_EXTENSION_BASE_URL,
  RCM_TAG_SYSTEM,
} from 'utils/lib/fhir/constants';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { AdHocBillingOutputSchema } from 'utils/lib/types/adhoc/datasets/billing';
import { AdHocPatientsOutputSchema } from 'utils/lib/types/adhoc/datasets/patients';
import {
  PATIENT_HAS_MEDICAID_URL,
  PATIENT_INDIVIDUAL_PRONOUNS_CUSTOM_URL,
  PATIENT_INDIVIDUAL_PRONOUNS_URL,
  PRACTICE_NAME_URL,
  PREFERRED_COMMUNICATION_METHOD_EXTENSION_URL,
} from 'utils/lib/types/constants';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { PATIENT_CONTAINED_PHARMACY_ID } from '../src/ehr/shared/harvest';
import { fetchAdHocBillingRows } from '../src/shared/adhoc-datasets/billing';
import { fetchAdHocPatientRows } from '../src/shared/adhoc-datasets/patients';
import { makeProcedureResource } from '../src/shared/chart-data';

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
  name: [
    { given: ['Jane', 'Marie'], family: 'Doe', suffix: ['III'] },
    { given: ['JJ'], use: 'nickname' },
  ],
  address: [{ line: ['12 Elm St', 'Apt 4'], city: 'Hoboken', state: 'NJ', postalCode: '07030' }],
  birthDate: '2010-01-01',
  gender: 'female',
  communication: [{ language: { coding: [{ code: 'es', display: 'Spanish' }] }, preferred: true }],
  extension: [
    { url: `${PRIVATE_EXTENSION_BASE_URL}/race`, valueCodeableConcept: codeable('Asian') },
    { url: `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`, valueCodeableConcept: codeable('Not Hispanic or Latino') },
    { url: `${PRIVATE_EXTENSION_BASE_URL}/send-marketing`, valueBoolean: true },
    {
      url: PATIENT_INDIVIDUAL_PRONOUNS_URL,
      valueCodeableConcept: { coding: [{ code: 'LA0000-0', display: 'My pronouns are not listed' }] },
    },
    { url: PATIENT_INDIVIDUAL_PRONOUNS_CUSTOM_URL, valueString: 'Ze/zir' },
    { url: PREFERRED_COMMUNICATION_METHOD_EXTENSION_URL, valueString: 'Cell Phone' },
    { url: PATIENT_HAS_MEDICAID_URL, valueBoolean: true },
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
        birthDate: '1980-05-05',
        gender: 'female',
        telecom: [
          { system: 'phone', value: '5550101234' },
          { system: 'email', value: 'mary@example.test' },
        ],
        address: [{ line: ['12 Elm St'], city: 'Hoboken', state: 'NJ', postalCode: '07030' }],
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
    // The policy holder is the parent — a patient of the practice herself, not a RelatedPerson.
    subscriber: { reference: 'Patient/pat-parent' },
    payor: [{ reference: 'Organization/payer-1' }],
    class: [{ type: { coding: [{ code: 'plan' }] }, value: '60054' }],
    identifier: [
      { type: { coding: [{ code: 'MB' }] }, value: 'MEM-123', assigner: { reference: 'Organization/payer-1' } },
    ],
    relationship: { coding: [{ code: 'child', display: 'Child' }] },
  },
  {
    resourceType: 'Patient',
    id: 'pat-parent',
    name: [{ given: ['Mary'], family: 'Doe' }],
    birthDate: '1980-05-05',
    gender: 'female',
    address: [{ line: ['12 Elm St'], city: 'Hoboken', state: 'NJ', postalCode: '07030' }],
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
    telecom: [{ system: 'phone', value: '5550105678' }],
    relationship: [
      { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'EP', display: 'Spouse' }] },
    ],
  },
  // The MVA attorney as harvest writes it (buildAttorneyRelatedPerson).
  {
    resourceType: 'RelatedPerson',
    id: 'atty-1',
    patient: { reference: 'Patient/pat-1' },
    name: [{ given: ['Saul'], family: 'Goodwin' }],
    extension: [{ url: ATTORNEY_FIRM_EXTENSION_URL, valueString: 'Goodwin & Co' }],
    relationship: [
      { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'OTHER', display: 'MVA Attorney' }] },
    ],
  },
] as FhirResource[];

// enc-1's billed codes as the chart writes them: a CPT with modifier 25 and 2 units, and two diagnoses
// listed secondary-first on the Encounter.
const billedCpt = makeProcedureResource(
  'enc-1',
  'pat-1',
  {
    code: '99000',
    display: 'Specimen handling',
    modifier: [{ code: '25', display: 'Significant, separately identifiable E/M' }],
    billableUnits: 2,
  },
  'cpt-code'
);

const visitDiagnoses: FhirResource[] = [
  {
    resourceType: 'Condition',
    id: 'dx-a',
    subject: { reference: 'Patient/pat-1' },
    code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'J02.9' }] },
  },
  {
    resourceType: 'Condition',
    id: 'dx-b',
    subject: { reference: 'Patient/pat-1' },
    code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'R50.9' }] },
  },
] as FhirResource[];

// The clinical RCM pricing: payer-1's fee schedule (99000 with modifier 25 at $40) and the default-insurance
// charge master. A second charted CPT the fee schedule does not list prices as unknown.
const priceEntry = (code: string, amount: number, modifier?: string): Record<string, unknown> => ({
  priceComponent: [
    {
      type: 'base',
      code: { coding: [{ system: CPT_CODE_SYSTEM, code }] },
      amount: { value: amount, currency: 'USD' },
      ...(modifier ? { extension: [{ url: CPT_MODIFIER_EXTENSION_URL, valueCode: modifier }] } : {}),
    },
  ],
});

const pricingDefinitions: FhirResource[] = [
  {
    resourceType: 'ChargeItemDefinition',
    id: 'fs-1',
    status: 'active',
    url: 'https://example.test/fs-1',
    title: 'Aetna 2026',
    date: '2026-01-01',
    meta: { tag: [{ system: RCM_TAG_SYSTEM, code: 'fee-schedule' }] },
    useContext: [{ code: { code: 'payer' }, valueReference: { reference: 'Organization/payer-1' } }],
    propertyGroup: [priceEntry('99000', 30), priceEntry('99000', 40, '25')],
  },
  {
    resourceType: 'ChargeItemDefinition',
    id: 'cm-default',
    status: 'active',
    url: 'https://example.test/cm-default',
    title: 'Default 2026',
    date: '2026-01-01',
    meta: { tag: [{ system: RCM_TAG_SYSTEM, code: 'default-insurance' }] },
    propertyGroup: [priceEntry('99000', 55)],
  },
] as FhirResource[];
const unpricedCpt = makeProcedureResource('enc-1', 'pat-1', { code: '99999', display: 'Unlisted service' }, 'cpt-code');

// Notes on the patient record as the patient page writes them (patient-notes/create).
const patientNote = (id: string, text: string, lastUpdated: string, sent = lastUpdated): Communication => ({
  resourceType: 'Communication',
  id,
  status: 'completed',
  meta: { tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/patient`, code: 'patient-note' }], lastUpdated },
  subject: { reference: 'Patient/pat-1' },
  sender: { reference: 'Practitioner/prac-1', display: 'Nina Park' },
  sent,
  payload: [{ contentString: text }],
});

const patientNotes: Communication[] = [
  patientNote('pn-1', 'Prefers morning appointments', '2026-06-01T10:00:00.000Z'),
  // Edited after it was written: sent and lastUpdated drifted apart.
  patientNote('pn-2', 'Mother handles scheduling', '2026-06-20T10:00:00.000Z', '2026-06-10T10:00:00.000Z'),
];

const resourcesByJob: Record<string, FhirResource[]> = {
  ChargeItemDefinition: pricingDefinitions,
  Communication: patientNotes,
  'Procedure:encounter': [
    { ...billedCpt, id: 'cpt-1' },
    { ...unpricedCpt, id: 'cpt-2' },
  ],
  'Condition:byId': visitDiagnoses,
  Patient: [returningPatient, newPatient, ...accountResources],
  Appointment: [
    appointment('appt-1', 'pat-1'),
    appointment('appt-2', 'pat-2'),
    {
      ...encounter('enc-1', 'appt-1', 'pat-1'),
      // The visit is billed to insurance (the payment option chosen on the visit).
      extension: [{ url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL, valueString: 'insurance' }],
      diagnosis: [
        { condition: { reference: 'Condition/dx-b' }, rank: 2 },
        { condition: { reference: 'Condition/dx-a' }, rank: 1 },
      ],
    },
    // An open annotation follow-up of enc-1: it carries the visit's appointment reference, but it is not the visit.
    {
      ...encounter('enc-1-fu', 'appt-1', 'pat-1'),
      status: 'in-progress',
      type: buildFollowupEncounterType('annotation'),
      partOf: { reference: 'Encounter/enc-1' },
    },
    encounter('enc-2', 'appt-2', 'pat-2'),
    returningPatient,
    newPatient,
    location,
  ],
  // The chart lists are loaded per patient after the main search, one search per resource type.
  ...Object.fromEntries(
    ['AllergyIntolerance', 'Condition', 'MedicationStatement', 'Procedure', 'EpisodeOfCare'].map((type) => [
      type,
      // The search filters by the chart's tags; the untagged visit diagnosis is never returned.
      chartResources.filter((r) => r.resourceType === type && r.meta?.tag?.length),
    ])
  ),
  'Appointment:prior': [priorAppointment],
};

const jobIdFor = (resourceType: string, params: { name: string; value: string }[]): string => {
  if (resourceType === 'Appointment' && params.some((p) => p.name === 'patient')) return 'Appointment:prior';
  // Visit-scoped billing codes vs the patient's chart lists.
  if (resourceType === 'Procedure' && params.some((p) => p.name === 'encounter')) return 'Procedure:encounter';
  if (resourceType === 'Condition' && params.some((p) => p.name === '_id')) return 'Condition:byId';
  return resourceType;
};

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
    search: async (
      { resourceType, params }: { resourceType: string; params: { name: string; value: string }[] },
      options?: { mode?: string }
    ) =>
      options?.mode === 'async-bulk'
        ? { jobId: jobIdFor(resourceType, params ?? []), contentLocation: '', mode: 'bulk' }
        : // A plain (paginated) search: one page with no next link.
          { unbundle: () => resourcesByJob[jobIdFor(resourceType, params ?? [])] ?? [], link: [] },
    waitForAsyncJob: async (jobId: string) => ({ status: 200, mode: 'bulk', manifest: manifestFor(jobId) }),
  },
  user: { list: async () => [] },
} as unknown as Oystehr;

const dateRange = { start: '2026-07-01T00:00:00.000Z', end: '2026-07-02T00:00:00.000Z' };

const issuesOf = (result: { success: boolean; error?: { issues: unknown[] } }): unknown[] =>
  result.success ? [] : result.error?.issues ?? ['unknown'];

describe('ad-hoc Billing: coverage and codes as the patient record and the chart have them (fixture)', () => {
  it("coverage: the account's primary coverage, resolved payer, MB member id", async () => {
    const rows = await fetchAdHocBillingRows(fakeOystehr, { dateRange, includeCoverage: true });
    expect(issuesOf(AdHocBillingOutputSchema.safeParse({ rows }))).toEqual([]);
    expect(rows.find((r) => r.appointmentId === 'appt-1')).toMatchObject({
      payerType: 'Insured',
      primaryPayer: 'Aetna',
      memberId: 'MEM-123',
      subscriberRelationship: 'Child',
      coverageStatus: 'active',
      secondaryPayer: '',
    });
    expect(rows.find((r) => r.appointmentId === 'appt-2')).toMatchObject({ payerType: 'Unknown', primaryPayer: '' });
  });

  it("charges: priced as the EHR's patient payments prices the visit", async () => {
    const rows = await fetchAdHocBillingRows(fakeOystehr, { dateRange, includeCharges: true });
    expect(issuesOf(AdHocBillingOutputSchema.safeParse({ rows }))).toEqual([]);
    // Insurance visit → the payer's fee schedule; 99000 with modifier 25 × 2 units = $80; 99999 is not listed.
    expect(rows.find((r) => r.appointmentId === 'appt-1')).toMatchObject({
      pricingSource: 'fee-schedule',
      pricingScheduleName: 'Aetna 2026',
      chargeCpts: ['99000', '99999'],
      chargeCount: 2,
      expectedCharge: 80,
      unpricedCpts: ['99999'],
      caseRate: null,
    });
    // No payment option chosen yet → the default-insurance charge master; nothing charted, nothing to price.
    expect(rows.find((r) => r.appointmentId === 'appt-2')).toMatchObject({
      pricingSource: 'default-charge-master',
      pricingScheduleName: 'Default 2026',
      chargeCount: 0,
      expectedCharge: null,
    });
  });

  it('codes: CPT modifiers and units, primary diagnosis first', async () => {
    const rows = await fetchAdHocBillingRows(fakeOystehr, { dateRange, includeCodes: true });
    expect(issuesOf(AdHocBillingOutputSchema.safeParse({ rows }))).toEqual([]);
    expect(rows.find((r) => r.appointmentId === 'appt-1')).toMatchObject({
      cptCodes: ['99000', '99999'],
      cptModifiers: ['25', ''],
      cptBillableUnits: [2, 1],
      emCode: '',
      icdCodes: ['J02.9', 'R50.9'],
    });
  });
});

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
      responsiblePartySex: 'Female',
      responsiblePartyPhone: '(555) 010-1234',
      responsiblePartyEmail: 'mary@example.test',
      responsiblePartyAddress: '12 Elm St, Hoboken, NJ 07030',
      emergencyContactRelationship: 'Spouse',
      emergencyContactName: 'Tom Doe',
      emergencyContactPhone: '(555) 010-5678',
      emergencyContactAddress: '',
      hasAttorney: true,
      attorneyFirm: 'Goodwin & Co',
      attorneyName: 'Saul Goodwin',
      attorneyEmail: '',
      insured: true,
      primaryInsuranceCarrier: 'Aetna',
      primaryMemberId: 'MEM-123',
      primaryRelationshipToInsured: 'Child',
      // The policy holder is another Patient of the practice: the bulk account search keeps her, as the
      // single-patient search includes her as the Coverage subscriber.
      primaryPolicyHolderName: 'Mary Doe',
      primaryPolicyHolderSex: 'Female',
      primaryPolicyHolderAddress: '12 Elm St, Hoboken, NJ 07030',
      secondaryInsuranceCarrier: '',
      secondaryPolicyHolderName: '',
      occupationalMedicineEmployer: 'Acme Corp',
      workersCompEmployer: '',
      workersCompEmployerAddress: '',
      workersCompMemberId: '',
    });
    expect(rows.find((r) => r.patientId === 'pat-1')?.responsiblePartyDateOfBirth).toContain('1980');
    expect(rows.find((r) => r.patientId === 'pat-1')?.primaryPolicyHolderDateOfBirth).toContain('1980');
    expect(rows.find((r) => r.patientId === 'pat-2')).toMatchObject({
      responsiblePartyRelationship: '',
      hasAttorney: false,
      attorneyFirm: '',
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
      { name: 'Penicillin', current: true, note: '' },
      { name: 'Aspirin', current: false, note: '' },
    ]);
    expect(row.problems).toEqual(['Asthma']);
    expect(row.problemCodes).toEqual(['J45.909']);
    expect(row.problemDetails).toEqual([{ display: 'Asthma', code: 'J45.909', current: true, note: '' }]);
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

  it('base: an open follow-up does not replace the visit it belongs to', async () => {
    const rows = await fetchAdHocPatientRows(fakeOystehr, { dateRange });
    // The finished visit's status, not the open follow-up's.
    expect(rows.find((r) => r.patientId === 'pat-1')?.lastVisitStatus).toBe('completed');
    expect(rows.find((r) => r.patientId === 'pat-1')?.totalVisits).toBe(1);
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
      preferredName: 'JJ',
      pronouns: 'Ze/zir',
      preferredCommunicationMethod: 'Cell Phone',
      hasMedicaid: true,
    });
    expect(returning.pcpName).toContain('Care');
    expect(returning).toMatchObject({
      middleName: 'Marie',
      nameSuffix: 'III',
      addressLine1: '12 Elm St',
      addressLine2: 'Apt 4',
      authorizedNonLegalGuardians: '',
      genderIdentityDetails: '',
      pcpAddress: '',
      pcpPhone: '',
      preferredPharmacyAddress: '',
      preferredPharmacyPhone: '',
    });

    const fresh = rows.find((r) => r.patientId === 'pat-2')!;
    expect(fresh).toMatchObject({
      preferredLanguage: '',
      hasPcp: false,
      preferredPharmacy: '',
      deceased: true,
      preferredName: '',
      pronouns: '',
      preferredCommunicationMethod: '',
      hasMedicaid: false,
      middleName: '',
      addressLine1: '',
    });
  });

  it("notes: the patient page's notes, newest first, with the edited marker", async () => {
    const rows = await fetchAdHocPatientRows(fakeOystehr, { dateRange, includeNotes: true });
    expect(issuesOf(AdHocPatientsOutputSchema.safeParse({ patients: rows }))).toEqual([]);
    const returning = rows.find((r) => r.patientId === 'pat-1')!;
    expect(returning.patientNotes).toEqual([
      { text: 'Mother handles scheduling', author: 'Nina Park', addedAt: '2026-06-20T10:00:00.000Z', edited: true },
      { text: 'Prefers morning appointments', author: 'Nina Park', addedAt: '2026-06-01T10:00:00.000Z', edited: false },
    ]);
    expect(returning.patientNoteCount).toBe(2);
    expect(rows.find((r) => r.patientId === 'pat-2')).toMatchObject({ patientNotes: [], patientNoteCount: 0 });
  });
});
