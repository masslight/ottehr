import Oystehr from '@oystehr/sdk';
import {
  ActivityDefinition,
  Appointment,
  ClinicalImpression,
  Communication,
  Condition,
  DocumentReference,
  Encounter,
  FhirResource,
  HealthcareService,
  Location,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  Observation,
  Patient,
  Practitioner,
  Provenance,
  QuestionnaireResponse,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import {
  APPOINTMENT_LOCKED_META_TAG,
  ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL,
  ENCOUNTER_VISIT_OCCUPATIONAL_MEDICINE_EMPLOYER_EXTENSION_URL,
  FHIR_EXTENSION,
  INTAKE_PAPERWORK_QR_TAG,
  OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
  PARTICIPATION_CODE_SYSTEM,
  PERFORMER_TYPE_SYSTEM,
  PRIVATE_EXTENSION_BASE_URL,
  PROCEDURE_TYPE_SYSTEM,
  PROVIDER_TYPE_EXTENSION_URL,
  ROOM_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
} from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { ORDER_TYPE_CODE_SYSTEM, SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL } from 'utils/lib/fhir/radiology';
import { CODE_SYSTEM_SERVICE_CATEGORY_CODES } from 'utils/lib/helpers/rcm/constants';
import { AdHocEncountersOutputSchema } from 'utils/lib/types/adhoc/datasets/encounters';
import {
  VitalBloodPressureObservationMethod,
  VitalFieldNames,
  VitalHeartbeatObservationMethod,
  VitalsOxygenSatObservationMethod,
  VitalTemperatureObservationMethod,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM, VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
} from 'utils/lib/types/api/medication-administration.constants';
import { REASON_FOR_VISIT_SEPARATOR } from 'utils/lib/types/constants';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { DataEntryTestItem } from 'utils/lib/types/data/in-house/in-house.types';
import {
  LAB_ORDER_TASK,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
} from 'utils/lib/types/data/labs/labs.constants';
import { DISCHARGE_SUMMARY_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  CONTAINED_MEDICATION_ID,
  IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL,
} from '../src/ehr/immunization/common';
import { inHouseResults } from '../src/shared/adhoc-datasets/encounter-orders';
import { fetchAdHocEncounterRows } from '../src/shared/adhoc-datasets/encounters';
import { makeObservationResource } from '../src/shared/chart-data';

// Fixture tests for the Encounters layers that reuse the app's own mappers (tracking-board orders, chart
// sections, visit-note signatures, tracking-board paperwork). The stubbed Oystehr serves each async-bulk
// job by resource type (plus a suffix for the searches that share a type), and the mapped rows must parse
// against the dataset's own Output schema.

const visitStatusEntry = (
  status: string,
  start: string,
  end?: string
): NonNullable<Encounter['statusHistory']>[number] => ({
  status: 'in-progress',
  period: { start, ...(end ? { end } : {}) },
  extension: [{ url: FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url, valueCode: status }],
});

const participant = (
  coding: typeof PRACTITIONER_CODINGS.Attender,
  id: string
): NonNullable<Encounter['participant']>[number] => ({
  type: [{ coding }],
  individual: { reference: `Practitioner/${id}` },
});

const appointment = (id: string, status: Appointment['status'], extra: Partial<Appointment> = {}): Appointment => ({
  resourceType: 'Appointment',
  id,
  status,
  start: '2026-07-01T14:00:00.000Z',
  end: '2026-07-01T14:30:00.000Z',
  meta: { tag: [{ code: OTTEHR_MODULE.IP }] },
  participant: [
    { actor: { reference: 'Patient/pat-1' }, status: 'accepted' },
    { actor: { reference: 'Location/loc-1' }, status: 'accepted' },
  ],
  ...extra,
});

const signedAppointment = appointment('appt-1', 'fulfilled', {
  meta: { tag: [{ code: OTTEHR_MODULE.IP }, APPOINTMENT_LOCKED_META_TAG] },
  created: '2026-06-28T09:00:00.000Z',
  description: `Sore throat${REASON_FOR_VISIT_SEPARATOR}worse at night`,
  extension: [{ url: ROOM_EXTENSION_URL, valueString: 'Room 4' }],
  participant: [
    { actor: { reference: 'Patient/pat-1' }, status: 'accepted' },
    { actor: { reference: 'Location/loc-1' }, status: 'accepted' },
    { actor: { reference: 'HealthcareService/grp-1' }, status: 'accepted' },
  ],
});
const cancelledAppointment = appointment('appt-2', 'cancelled', {
  // A pre-op visit: its employer is the one picked for the visit, not the patient account's.
  serviceCategory: [
    { coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: CODE_SYSTEM_SERVICE_CATEGORY_CODES['pre-op'] }] },
  ],
  cancelationReason: {
    coding: [
      {
        code: 'Patient improved',
        display: 'Patient improved',
        extension: [
          {
            url: 'https://fhir.zapehr.com/StructureDefinition/cancellation-reason-additional-info',
            valueString: 'feeling better',
          },
        ],
      },
    ],
  },
});

const signedEncounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'finished',
  class: { code: 'AMB' },
  appointment: [{ reference: 'Appointment/appt-1' }],
  subject: { reference: 'Patient/pat-1' },
  participant: [
    participant(PRACTITIONER_CODINGS.Attender, 'prac-1'),
    participant(PRACTITIONER_CODINGS.Admitter, 'prac-2'),
  ],
  hospitalization: {
    dischargeDisposition: {
      coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/discharge-disposition`, code: 'specialty' }],
      text: 'See cardiology this week',
    },
  },
  extension: [
    { url: ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL, valueString: 'selfPay' },
    { url: 'awaiting-supervisor-approval', valueBoolean: false },
  ],
  statusHistory: [
    visitStatusEntry('arrived', '2026-07-01T14:00:00.000Z', '2026-07-01T14:05:00.000Z'),
    visitStatusEntry('provider', '2026-07-01T14:05:00.000Z', '2026-07-01T14:20:00.000Z'),
    visitStatusEntry('discharged', '2026-07-01T14:20:00.000Z', '2026-07-01T14:40:00.000Z'),
    visitStatusEntry('awaiting supervisor approval', '2026-07-01T14:40:00.000Z', '2026-07-01T15:00:00.000Z'),
    visitStatusEntry('completed', '2026-07-01T15:00:00.000Z'),
  ],
};

const cancelledEncounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-2',
  status: 'cancelled',
  class: { code: 'AMB' },
  appointment: [{ reference: 'Appointment/appt-2' }],
  subject: { reference: 'Patient/pat-1' },
  extension: [
    {
      url: ENCOUNTER_VISIT_OCCUPATIONAL_MEDICINE_EMPLOYER_EXTENSION_URL,
      valueReference: { reference: 'Organization/emp-preop' },
    },
  ],
  statusHistory: [visitStatusEntry('cancelled', '2026-07-01T13:00:00.000Z')],
};

// The patient's occupational-medicine Account, owned by the employer, and the pre-op visit's employer.
const occMedAccount: FhirResource = {
  resourceType: 'Account',
  id: 'acct-om',
  status: 'active',
  type: OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
  subject: [{ reference: 'Patient/pat-1' }],
  owner: { reference: 'Organization/emp-1' },
};

const accountEmployer: FhirResource = {
  resourceType: 'Organization',
  id: 'emp-1',
  name: 'Acme Corp',
  type: [
    { coding: [{ system: FHIR_EXTENSION.Organization.organizationType.url, code: 'occupational-medicine-employer' }] },
  ],
};

const preOpEmployer: FhirResource = { resourceType: 'Organization', id: 'emp-preop', name: 'City Hospital' };

const patient: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ given: ['Jane'], family: 'Doe' }],
  birthDate: '2010-01-01',
  gender: 'female',
};

const location: Location = { resourceType: 'Location', id: 'loc-1', name: 'Midtown Clinic', address: { state: 'NY' } };

const practitioner = (id: string, given: string, family: string, providerType?: string): Practitioner => ({
  resourceType: 'Practitioner',
  id,
  name: [{ given: [given], family }],
  ...(providerType
    ? { extension: [{ url: PROVIDER_TYPE_EXTENSION_URL, valueCodeableConcept: { coding: [{ code: providerType }] } }] }
    : {}),
});

const attending = practitioner('prac-1', 'Nina', 'Park', 'NP');
const intakeNurse = practitioner('prac-2', 'Ivy', 'Lee');
const supervisor = practitioner('prac-3', 'Sam', 'Stone', 'MD');

const signatureProvenance = (id: string, role: 'author' | 'verifier', who: string, recorded: string): Provenance => ({
  resourceType: 'Provenance',
  id,
  target: [{ reference: 'Encounter/enc-1' }],
  recorded,
  agent: [
    {
      role: [{ coding: [{ system: PARTICIPATION_CODE_SYSTEM, code: role }] }],
      who: { reference: `Practitioner/${who}` },
    },
  ],
});

const paperworkQr: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  id: 'qr-1',
  status: 'completed',
  meta: { tag: [INTAKE_PAPERWORK_QR_TAG] },
  encounter: { reference: 'Encounter/enc-1' },
  authored: '2026-07-01T13:30:00.000Z',
  item: [],
};

const photoIdDocRef: DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'doc-id',
  status: 'current',
  type: { text: 'Photo ID cards' },
  context: { related: [{ reference: 'Patient/pat-1' }] },
  content: [{ attachment: { title: 'photo-id-front' } }],
};

const dischargeSummary: DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'doc-ds',
  status: 'current',
  type: { coding: [{ code: DISCHARGE_SUMMARY_CODE }] },
  context: { encounter: [{ reference: 'Encounter/enc-1' }] },
  content: [{ attachment: {} }],
};

const chiefComplaint: Condition = {
  resourceType: 'Condition',
  id: 'cc-1',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  meta: { tag: [{ code: 'chief-complaint' }] },
  note: [{ text: 'Sore throat for 3 days' }],
};

const medicalDecision: ClinicalImpression = {
  resourceType: 'ClinicalImpression',
  id: 'mdm-1',
  status: 'completed',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  meta: { tag: [{ code: 'medical-decision' }] },
  summary: 'Likely viral pharyngitis',
};

const instruction: Communication = {
  resourceType: 'Communication',
  id: 'comm-1',
  status: 'completed',
  encounter: { reference: 'Encounter/enc-1' },
  meta: { tag: [{ code: 'patient-instruction' }] },
  payload: [{ contentString: 'Rest and fluids' }],
};

const procedureRequest: ServiceRequest = {
  resourceType: 'ServiceRequest',
  id: 'sr-proc',
  status: 'completed',
  intent: 'original-order',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  meta: { tag: [{ code: 'procedure' }] },
  category: [{ coding: [{ system: PROCEDURE_TYPE_SYSTEM, code: 'Laceration repair' }] }],
  performerType: { coding: [{ system: PERFORMER_TYPE_SYSTEM, code: 'Provider' }] },
  occurrenceDateTime: '2026-07-01T14:10:00.000Z',
};

// The disposition's follow-up request, as the chart writes it (orderDetail by system, offset in minutes).
const dispositionFollowUp: ServiceRequest = {
  resourceType: 'ServiceRequest',
  id: 'sr-dispo',
  status: 'active',
  intent: 'plan',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  meta: { tag: [{ code: 'disposition-follow-up' }] },
  orderDetail: [{ coding: [{ system: 'specialty-transfer', code: 'Cardiologist' }] }],
  occurrenceTiming: { repeat: { offset: 2880 } },
};

// A vaccine ordered but not given yet, and one the patient declined — as the immunization order writes them.
const vaccineOrder = (
  id: string,
  name: string,
  status: MedicationAdministration['status'],
  note?: string
): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id,
  status,
  meta: { tag: [{ code: 'immunization' }] },
  subject: { reference: 'Patient/pat-1' },
  context: { reference: 'Encounter/enc-1' },
  effectiveDateTime: '2026-07-01T14:20:00.000Z',
  extension: [{ url: IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL, valueDateTime: '2026-07-01T14:20:00.000Z' }],
  performer: [
    {
      actor: { reference: 'Practitioner/prac-1', display: 'Nina Park' },
      function: {
        coding: [
          { system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM, code: PRACTITIONER_ORDERED_BY_MEDICATION_CODE },
        ],
      },
    },
  ],
  ...(note ? { note: [{ text: note }] } : {}),
  contained: [
    {
      resourceType: 'Medication',
      id: CONTAINED_MEDICATION_ID,
      identifier: [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name }],
    } as Medication,
  ],
});

// eRx prescription as the eRx sync writes it.
const prescription: MedicationRequest = {
  resourceType: 'MedicationRequest',
  id: 'mr-1',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  requester: { reference: 'Practitioner/prac-1' },
  medicationCodeableConcept: {
    coding: [{ system: MEDICATION_DISPENSABLE_DRUG_ID, code: '12345', display: 'Amoxicillin 500 mg capsule' }],
  },
  dosageInstruction: [{ patientInstruction: 'Take 1 capsule 3 times a day' }],
};

// A STAT left-shoulder X-ray, still pending.
const statXray: ServiceRequest = {
  resourceType: 'ServiceRequest',
  id: 'sr-xr',
  status: 'active',
  intent: 'order',
  priority: 'stat',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  requester: { reference: 'Practitioner/prac-1' },
  authoredOn: '2026-07-01T14:06:00.000Z',
  meta: { tag: [{ system: ORDER_TYPE_CODE_SYSTEM, code: 'radiology' }] },
  code: { coding: [{ code: '73030-LT', display: 'XR shoulder' }] },
  reasonCode: [{ coding: [{ code: 'S43.401A', display: 'Sprain of shoulder' }] }],
  extension: [{ url: SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL, valueDateTime: '2026-07-01T14:06:00.000Z' }],
};

// Vitals written by the chart's own writer (save-chart-data → makeObservationResource), at fixed times.
const vital = (encounterId: string, dto: VitalsObservationDTO, at: string, author = 'prac-2'): Observation => ({
  ...makeObservationResource(
    encounterId,
    'pat-1',
    author,
    undefined,
    dto,
    PATIENT_VITALS_META_SYSTEM,
    undefined,
    undefined,
    undefined
  ),
  id: `vit-${encounterId}-${dto.field}-${at}`,
  effectiveDateTime: at,
});

const vitals: Observation[] = [
  vital(
    'enc-1',
    { field: VitalFieldNames.VitalTemperature, value: 37, observationMethod: VitalTemperatureObservationMethod.Oral },
    '2026-07-01T14:06:00.000Z'
  ),
  vital(
    'enc-1',
    { field: VitalFieldNames.VitalHeartbeat, value: 80, observationMethod: VitalHeartbeatObservationMethod.Sitting },
    '2026-07-01T14:06:00.000Z'
  ),
  vital(
    'enc-1',
    {
      field: VitalFieldNames.VitalBloodPressure,
      systolicPressure: 120,
      diastolicPressure: 80,
      observationMethod: VitalBloodPressureObservationMethod.Standing,
    },
    '2026-07-01T14:06:00.000Z'
  ),
  vital(
    'enc-1',
    {
      field: VitalFieldNames.VitalOxygenSaturation,
      value: 98,
      observationMethod: VitalsOxygenSatObservationMethod.OnRoomAir,
    },
    '2026-07-01T14:06:00.000Z'
  ),
  vital('enc-1', { field: VitalFieldNames.VitalWeight, value: 70 }, '2026-07-01T14:07:00.000Z'),
  vital('enc-1', { field: VitalFieldNames.VitalHeight, value: 170 }, '2026-07-01T14:07:00.000Z'),
  vital(
    'enc-1',
    {
      field: VitalFieldNames.VitalVision,
      leftEyeVisionText: '20/20',
      rightEyeVisionText: '20/40',
      extraVisionOptions: ['with_glasses'],
    },
    '2026-07-01T14:08:00.000Z'
  ),
  vital(
    'enc-1',
    { field: VitalFieldNames.VitalLastMenstrualPeriod, value: '2026-06-10', isUnsure: true },
    '2026-07-01T14:08:00.000Z'
  ),
  // A DOT vision screening is its own entry on the vision vital — here recorded later, by another staff member.
  vital(
    'enc-1',
    {
      field: VitalFieldNames.VitalVision,
      leftEyeVisionText: '',
      rightEyeVisionText: '',
      dotVisionScreening: {
        horizontalFieldLeftDegrees: 70,
        horizontalFieldRightDegrees: 75,
        canRecognizeColors: true,
        hasMonocularVision: false,
        referredToSpecialist: false,
      },
    },
    '2026-07-01T14:09:00.000Z',
    'prac-3'
  ),
  vital(
    'enc-2',
    { field: VitalFieldNames.VitalWeight, extraWeightOptions: ['patient_refused'] },
    '2026-07-01T13:01:00.000Z'
  ),
];

const group: HealthcareService = { resourceType: 'HealthcareService', id: 'grp-1', name: 'Pediatrics Group' };

// External lab: submitted (PST completed, order active, submit Provenance), no results yet → "sent".
const externalLabRequest: ServiceRequest = {
  resourceType: 'ServiceRequest',
  id: 'sr-lab',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  requester: { reference: 'Practitioner/prac-1' },
  code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: 'CBC', display: 'CBC' }] },
  reasonCode: [{ coding: [{ code: 'J02.9', display: 'Acute pharyngitis' }] }],
  contained: [
    {
      resourceType: 'ActivityDefinition',
      id: 'ad-1',
      status: 'active',
      publisher: 'Quest',
      code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: 'CBC', display: 'Complete blood count' }] },
    } as ActivityDefinition,
  ],
};

const pstTask: Task = {
  resourceType: 'Task',
  id: 'task-pst',
  status: 'completed',
  intent: 'order',
  authoredOn: '2026-07-01T14:12:00.000Z',
  basedOn: [{ reference: 'ServiceRequest/sr-lab' }],
  code: { coding: [{ system: LAB_ORDER_TASK.system, code: LAB_ORDER_TASK.code.preSubmission }] },
};

const submitProvenance: Provenance = {
  resourceType: 'Provenance',
  id: 'prov-submit',
  target: [{ reference: 'ServiceRequest/sr-lab' }],
  recorded: '2026-07-01T14:15:00.000Z',
  activity: { coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.submit] },
  agent: [{ who: { reference: 'Practitioner/prac-1' } }],
};

// Nursing order: requested Task → pending; the create-order Provenance names the ordering provider.
const nursingRequest: ServiceRequest = {
  resourceType: 'ServiceRequest',
  id: 'sr-nurse',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  authoredOn: '2026-07-01T14:08:00.000Z',
  meta: { tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/order-type-tag`, code: 'nursing order' }] },
  note: [{ text: 'Rapid strep swab' }],
};

const nursingTask: Task = {
  resourceType: 'Task',
  id: 'task-nurse',
  status: 'requested',
  intent: 'order',
  basedOn: [{ reference: 'ServiceRequest/sr-nurse' }],
};

const nursingProvenance: Provenance = {
  resourceType: 'Provenance',
  id: 'prov-nurse',
  target: [{ reference: 'ServiceRequest/sr-nurse' }],
  recorded: '2026-07-01T14:08:00.000Z',
  activity: { coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder] },
  agent: [{ who: { reference: 'Practitioner/prac-1' } }],
};

const resourcesByJob: Record<string, FhirResource[]> = {
  Appointment: [signedAppointment, cancelledAppointment, signedEncounter, cancelledEncounter, patient, location],
  Practitioner: [attending, intakeNurse, supervisor],
  Provenance: [
    signatureProvenance('prov-author', 'author', 'prac-1', '2026-07-01T14:40:00.000Z'),
    signatureProvenance('prov-verifier', 'verifier', 'prac-3', '2026-07-01T15:00:00.000Z'),
    attending,
    supervisor,
  ],
  QuestionnaireResponse: [paperworkQr],
  'DocumentReference:related': [photoIdDocRef],
  DocumentReference: [dischargeSummary],
  Condition: [chiefComplaint],
  ClinicalImpression: [medicalDecision],
  Communication: [instruction],
  ServiceRequest: [procedureRequest, externalLabRequest, nursingRequest, dispositionFollowUp],
  HealthcareService: [group],
  Observation: vitals,
  Patient: [patient, occMedAccount, accountEmployer],
  Organization: [preOpEmployer],
  MedicationAdministration: [
    vaccineOrder('ma-tdap', 'Tdap', 'in-progress'),
    vaccineOrder('ma-flu', 'Influenza', 'not-done', 'Patient declined'),
  ],
  MedicationRequest: [prescription],
  'ServiceRequest:radiology': [statXray, attending],
  'ServiceRequest:orders': [
    externalLabRequest,
    nursingRequest,
    pstTask,
    nursingTask,
    submitProvenance,
    nursingProvenance,
    attending,
  ],
};

// Searches sharing a resource type are told apart by what they ask for.
const jobIdFor = (resourceType: string, params: { name: string; value: string }[]): string => {
  if (resourceType === 'ServiceRequest' && params.some((p) => p.name === '_tag' && p.value.endsWith('|radiology')))
    return 'ServiceRequest:radiology';
  if (resourceType === 'ServiceRequest' && params.some((p) => p.value === 'Task:based-on'))
    return 'ServiceRequest:orders';
  if (resourceType === 'DocumentReference' && params.some((p) => p.name === 'related'))
    return 'DocumentReference:related';
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

const allLayers = {
  includeDisposition: true,
  includeVitals: true,
  includeEmployer: true,
  includeImaging: true,
  includeImmunizations: true,
  includeMedications: true,
  includeLabs: true,
  includeNursing: true,
  includeProcedures: true,
  includeSigning: true,
  includePaperwork: true,
  includeCharting: true,
};

describe('ad-hoc Encounters: layers mapped with the app mappers (fixture)', () => {
  it('rows parse against the schema', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, ...allLayers });
    expect(rows).toHaveLength(2);
    expect(issuesOf(AdHocEncountersOutputSchema.safeParse({ encounters: rows }))).toEqual([]);
  });

  it('base: provider type, intake performer, payment variant, cancellation reason', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    const cancelled = rows.find((r) => r.appointmentId === 'appt-2')!;
    expect(signed.attendingProviderType).toBe('NP');
    expect(signed.intakePerformer).toBe('Ivy Lee');
    expect(signed.paymentVariant).toBe('selfPay');
    expect(signed.cancellationReason).toBe('');
    expect(cancelled.cancellationReason).toBe('Patient improved');
    expect(cancelled.cancellationReasonDisplay).toBe('Patient improved - feeling better');
    expect(cancelled.attendingProviderType).toBeNull();
    expect(cancelled.paymentVariant).toBeNull();
  });

  it('base: booking time, reason split, room and group', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.bookedAt).toBe('2026-06-28T09:00:00.000Z');
    expect(signed.reasonForVisit).toBe('Sore throat');
    expect(signed.reasonDetails).toBe('worse at night');
    expect(signed.room).toBe('Room 4');
    expect(signed.group).toBe('Pediatrics Group');
    const cancelled = rows.find((r) => r.appointmentId === 'appt-2')!;
    expect(cancelled).toMatchObject({ bookedAt: null, reasonForVisit: '', room: '', group: '' });
  });

  it('disposition: the chart disposition DTO', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeDisposition: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed).toMatchObject({
      dischargeDisposition: 'See cardiology this week',
      dispositionType: 'specialty',
      dispositionLabel: 'Specialty Transfer',
      followUpInDays: 2,
      transferSpecialty: 'Cardiologist',
      transferSpecialtyOther: '',
      nothingToEatOrDrink: false,
    });
    const cancelled = rows.find((r) => r.appointmentId === 'appt-2')!;
    expect(cancelled).toMatchObject({ dispositionType: null, dispositionLabel: '', followUpInDays: null });
  });

  it('medications: eRx through the chart eRx DTO', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeMedications: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.drugs).toHaveLength(1);
    expect(signed.drugs?.[0]).toMatchObject({
      name: 'Amoxicillin 500 mg capsule',
      source: 'eRx',
      status: 'prescribed',
      erxStatus: 'active',
      instructions: 'Take 1 capsule 3 times a day',
      isRenewal: false,
      orderedBy: 'Nina Park',
      lotNumber: null,
    });
    expect(signed.medicationCodes).toEqual(['12345']);
  });

  it('immunizations: vaccine orders not given, with the reason', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeImmunizations: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.vaccines).toEqual([]);
    expect(signed.vaccinesNotGiven).toEqual([
      { name: 'Tdap', status: 'pending', reason: null, orderedAt: '2026-07-01T14:20:00.000Z', orderedBy: 'Nina Park' },
      {
        name: 'Influenza',
        status: 'not-administered',
        reason: 'Patient declined',
        orderedAt: '2026-07-01T14:20:00.000Z',
        orderedBy: 'Nina Park',
      },
    ]);
    expect(signed.vaccineNames).toEqual(['Tdap', 'Influenza']);
  });

  it('imaging: the radiology page order — STAT, laterality, diagnoses', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeImaging: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.imagingStudies).toEqual([
      {
        name: 'XR shoulder',
        status: 'pending',
        orderStatus: 'pending',
        orderedAt: '2026-07-01T14:06:00.000Z',
        performedAt: null,
        preliminaryAt: null,
        pendingFinalAt: null,
        finalAt: null,
        reviewedAt: null,
        cptCode: '73030',
        laterality: 'LT',
        stat: true,
        external: false,
        orderedBy: 'Nina Park',
        icdCodes: ['S43.401A'],
        performedBy: '',
        performingOrganization: '',
        safetyFlags: [],
        consentObtained: false,
      },
    ]);
  });

  it('employer: account employer, or the visit pick for pre-op', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeEmployer: true });
    expect(rows.find((r) => r.appointmentId === 'appt-1')?.occupationalMedicineEmployer).toBe('Acme Corp');
    expect(rows.find((r) => r.appointmentId === 'appt-2')?.occupationalMedicineEmployer).toBe('City Hospital');
  });

  it('vitals: every unit the chart shows, how each reading was taken, vision and LMP', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeVitals: true });
    expect(issuesOf(AdHocEncountersOutputSchema.safeParse({ encounters: rows }))).toEqual([]);
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed).toMatchObject({
      // the existing fields keep their values
      temperatureF: 98.6,
      weightKg: 70,
      heightCm: 170,
      // the same readings in the chart's other units
      temperatureC: 37,
      temperatureCReadings: [37],
      weightLbs: 154.3,
      heightInches: 66.93,
      heightFeetInches: `5'7"`,
      temperatureMethod: 'Oral',
      heartRateMethod: 'Sitting',
      bloodPressureMethod: 'Standing',
      oxygenSaturationMethod: 'On room air',
      weightRefused: false,
      visionLeftEye: '20/20',
      visionRightEye: '20/40',
      visionBothEyes: '',
      visionOptions: ['with_glasses'],
      lastMenstrualPeriodUnsure: true,
    });
    expect(signed.lastMenstrualPeriod?.startsWith('2026-06-10')).toBe(true);
    // The later DOT entry neither replaces the acuity reading above nor hides its own answers.
    expect(signed).toMatchObject({
      dotHorizontalFieldLeftDegrees: 70,
      dotHorizontalFieldRightDegrees: 75,
      dotCanRecognizeColors: true,
      dotMonocularVision: false,
      dotReferredToSpecialist: false,
      dotReceivedReferralDocumentation: null,
      vitalsRecordedBy: ['Ivy Lee', 'Sam Stone'],
      vitalsFirstRecordedAt: '2026-07-01T14:06:00.000Z',
    });

    const cancelled = rows.find((r) => r.appointmentId === 'appt-2')!;
    expect(cancelled).toMatchObject({
      weightKg: null,
      weightLbs: null,
      weightRefused: true,
      temperatureC: null,
      temperatureMethod: null,
      heightFeetInches: '',
      visionOptions: [],
      lastMenstrualPeriod: null,
      lastMenstrualPeriodUnsure: null,
      dotHorizontalFieldLeftDegrees: null,
      dotCanRecognizeColors: null,
      vitalsRecordedBy: ['Ivy Lee'],
      vitalsFirstRecordedAt: '2026-07-01T13:01:00.000Z',
    });
  });

  it('signing: signer, supervisor approval, charting lag, lock', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeSigning: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.signed).toBe(true);
    expect(signed.signedAt).toBe('2026-07-01T14:40:00.000Z');
    expect(signed.signedBy).toContain('Park, Nina'); // the visit note's "Last, First" signer format
    expect(signed.dischargedToSignedMinutes).toBe(20);
    expect(signed.awaitingSupervisorApproval).toBe(false);
    expect(signed.supervisorApprovedBy).toContain('Stone, Sam');
    expect(signed.supervisorApprovedAt).toBe('2026-07-01T15:00:00.000Z');
    expect(signed.locked).toBe(true);

    const cancelled = rows.find((r) => r.appointmentId === 'appt-2')!;
    expect(cancelled.signed).toBe(false);
    expect(cancelled.signedAt).toBeNull();
    expect(cancelled.signedBy).toBeNull();
    expect(cancelled.locked).toBe(false);
  });

  it('paperwork: tracking-board completeness flags', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includePaperwork: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.paperworkSubmittedAt).toBe('2026-07-01T13:30:00.000Z');
    expect(signed.demographicsComplete).toBe(true);
    expect(signed.photoIdOnFile).toBe(true);
    expect(signed.insuranceCardOnFile).toBe(false);
    expect(signed.consentComplete).toBe(false);
    expect(signed.consentMethod).toBeNull();
  });

  it('charting: chart-section fields and visit documents', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeCharting: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.chiefComplaint).toBe('Sore throat for 3 days');
    expect(signed.medicalDecision).toBe('Likely viral pharyngitis');
    expect(signed.patientInstructions).toEqual(['Rest and fluids']);
    expect(signed.historyOfPresentIllness).toBe('');
    expect(signed.dischargeSummaryCreated).toBe(true);
    expect(signed.patientEducationCount).toBe(0);
  });

  it('procedures: the chart procedures DTO flattened', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeProcedures: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.procedureCount).toBe(1);
    expect(signed.procedureTypes).toEqual(['Laceration repair']);
    expect(signed.procedures?.[0]).toMatchObject({
      type: 'Laceration repair',
      performerType: 'Provider',
      performedAt: '2026-07-01T14:10:00.000Z',
      consentObtained: null,
    });
  });

  it('labs and nursing: order-page statuses and timing', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeLabs: true, includeNursing: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.labTests).toHaveLength(1);
    expect(signed.labTests?.[0]).toMatchObject({
      name: 'Complete blood count',
      kind: 'external',
      lab: 'Quest',
      status: 'sent',
      orderedAt: '2026-07-01T14:12:00.000Z',
      submittedAt: '2026-07-01T14:15:00.000Z',
      resultedAt: null,
      isPSC: false,
      icdCodes: ['J02.9'],
      nonNormalResults: [],
    });
    expect(signed.labTestNames).toEqual(['Complete blood count']);
    expect(signed.labNames).toEqual(['Quest']);
    expect(signed.nursingOrderDetails).toEqual([
      { order: 'Rapid strep swab', status: 'pending', orderedAt: '2026-07-01T14:08:00.000Z', orderedBy: 'Nina Park' },
    ]);
  });

  it('in-house results: entered values read as labels, parallel to the components', () => {
    const labDetails = {
      components: {
        type: 'grouped',
        components: [
          {
            componentName: 'Strep A',
            dataType: 'CodeableConcept',
            valueSet: [
              { code: 'POS', display: 'Positive' },
              { code: 'NEG', display: 'Negative' },
            ],
            result: { entry: 'POS', interpretationCode: 'A' },
          },
          {
            componentName: 'Glucose',
            dataType: 'Quantity',
            unit: 'mg/dL',
            result: { entry: '95', interpretationCode: 'N' },
          },
          { componentName: 'Comment', dataType: 'string' },
        ],
      },
    } as unknown as DataEntryTestItem;
    expect(inHouseResults(labDetails)).toEqual({
      resultComponents: ['Strep A', 'Glucose'],
      resultValues: ['Positive', '95 mg/dL'],
      resultInterpretations: ['A', 'N'],
    });
  });
});
