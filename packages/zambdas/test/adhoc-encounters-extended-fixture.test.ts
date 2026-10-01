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
  ACCIDENT_STATE_EXTENSION,
  ACCIDENT_TYPE_SYSTEM,
  APPOINTMENT_LOCKED_META_TAG,
  ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL,
  ENCOUNTER_VISIT_OCCUPATIONAL_MEDICINE_EMPLOYER_EXTENSION_URL,
  ERX_MEDICATION_META_TAG_CODE,
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
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { getProviderNameWithProfession } from 'utils/lib/fhir/helpers';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { ORDER_TYPE_CODE_SYSTEM, SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL } from 'utils/lib/fhir/radiology';
import { CODE_SYSTEM_SERVICE_CATEGORY_CODES } from 'utils/lib/helpers/rcm/constants';
import { CONSENT_FORMS_CONFIG } from 'utils/lib/ottehr-config/consent-forms';
import { patientScreeningQuestionsConfig } from 'utils/lib/ottehr-config/screening-questions';
import { AdHocEncountersOutputSchema } from 'utils/lib/types/adhoc/datasets/encounters';
import {
  VitalBloodPressureObservationMethod,
  VitalFieldNames,
  VitalHeartbeatObservationMethod,
  VitalsOxygenSatObservationMethod,
  VitalTemperatureObservationMethod,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  NOTE_TYPE,
  NoteDTO,
  PATIENT_VITALS_META_SYSTEM,
  VitalsObservationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
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
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
} from 'utils/lib/types/data/labs/labs.constants';
import { NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY } from 'utils/lib/types/data/orders/constants';
import { DISCHARGE_SUMMARY_CODE, PATIENT_PHOTO_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  CONTAINED_MEDICATION_ID,
  IMMUNIZATION_ORDER_CREATED_DATETIME_EXTENSION_URL,
} from '../src/ehr/immunization/common';
import { inHouseResults } from '../src/shared/adhoc-datasets/encounter-orders';
import { fetchAdHocEncounterRows } from '../src/shared/adhoc-datasets/encounters';
import { makeNoteResource } from '../src/shared/chart-data';
import { makeExamObservationResource, makeObservationResource } from '../src/shared/chart-data';

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
  comment: 'Mom waiting in lobby',
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
    // Charted by staff on the visit note (ReasonForVisitField / VerifiedPatientInfo).
    { url: 'reason-for-visit', valueString: 'Sore throat, fever since Monday' },
    { url: 'patient-info-confirmed', valueBoolean: true },
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

// A screening question the patient answers in the intake paperwork (an option question), answered there.
const paperworkScreeningField = patientScreeningQuestionsConfig.fields.find(
  (f) => f.existsInQuestionnaire && f.options?.length
)!;

const paperworkScreeningOption = paperworkScreeningField.options![0];
const paperworkQr: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  id: 'qr-1',
  status: 'completed',
  meta: { tag: [INTAKE_PAPERWORK_QR_TAG] },
  encounter: { reference: 'Encounter/enc-1' },
  authored: '2026-07-01T13:30:00.000Z',
  item: [
    {
      linkId: 'screening-page',
      item: [
        { linkId: paperworkScreeningField.fhirField, answer: [{ valueString: paperworkScreeningOption.fhirValue }] },
      ],
    },
    {
      linkId: 'patient-details-page',
      item: [
        { linkId: 'person-accompanying-minor-first-name', answer: [{ valueString: 'Mary' }] },
        { linkId: 'person-accompanying-minor-last-name', answer: [{ valueString: 'Doe' }] },
        { linkId: 'relay-phone', answer: [{ valueString: '(555) 010-0199' }] },
      ],
    },
    {
      // The consent forms, signed in the paperwork (what getPaperworkCompleteness / the face sheet read).
      linkId: 'consent-forms-page',
      item: [
        ...CONSENT_FORMS_CONFIG.forms.map((form) => ({ linkId: form.id, answer: [{ valueBoolean: true }] })),
        { linkId: 'signature', answer: [{ valueString: 'Mary Doe' }] },
        { linkId: 'full-name', answer: [{ valueString: 'Mary Doe' }] },
        { linkId: 'consent-form-signer-relationship', answer: [{ valueString: 'Parent' }] },
      ],
    },
  ],
};

// A patient condition photo uploaded for the visit (upload-patient-condition-photo: related to the Appointment).
const conditionPhotoDocRef: DocumentReference = {
  resourceType: 'DocumentReference',
  id: 'doc-photo',
  status: 'current',
  type: { coding: [{ system: 'http://loinc.org', code: PATIENT_PHOTO_CODE }], text: 'Patient photos' },
  subject: { reference: 'Patient/pat-1' },
  context: { related: [{ reference: 'Appointment/appt-1' }] },
  content: [{ attachment: { url: 'z3://photos/rash-1.jpg', title: 'rash-1.jpg' } }],
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

// Provider notes written by the chart's own writer (save-chart-data → makeNoteResource), saved at `sent`.
const chartNote = (
  id: string,
  note: Pick<NoteDTO, 'type' | 'text'> & { deleted?: boolean },
  sent: string
): Communication => {
  const resource = makeNoteResource('enc-1', 'pat-1', {
    ...note,
    patientId: 'pat-1',
    encounterId: 'enc-1',
    authorId: 'prac-1',
    authorName: 'Nina Park',
  });

  return { ...resource, id, sent, meta: { ...resource.meta, lastUpdated: sent } };
};

const intakeNote = chartNote(
  'note-intake',
  { type: NOTE_TYPE.INTAKE, text: 'Pt arrived with mother' },
  '2026-07-01T14:02:00.000Z'
);

const addendum = chartNote(
  'note-addendum',
  { type: NOTE_TYPE.ADDENDUM, text: 'Culture came back negative' },
  '2026-07-02T09:00:00.000Z'
);

const deletedInternalNote = chartNote(
  'note-internal-deleted',
  { type: NOTE_TYPE.INTERNAL, text: 'wrong patient', deleted: true },
  '2026-07-01T14:03:00.000Z'
);

// The surgical history free-text note (encounter-notes chart section: Procedure tagged surgical-history-note).
const surgicalHistoryNote: FhirResource = {
  resourceType: 'Procedure',
  id: 'proc-shn',
  status: 'completed',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  meta: { tag: [{ code: 'surgical-history-note' }] },
  note: [{ text: 'Tonsils out at age 5' }],
};

// The chart's accident record ("Patient's condition related to": auto accident in NJ on the 28th).
const accidentCondition: Condition = {
  resourceType: 'Condition',
  id: 'cond-accident',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  meta: { tag: [{ code: 'accident' }] },
  onsetDateTime: '2026-06-28',
  code: {
    coding: [
      { system: ACCIDENT_TYPE_SYSTEM, code: 'AA' },
      { system: ACCIDENT_TYPE_SYSTEM, code: 'OA' },
    ],
  },
  extension: [{ url: ACCIDENT_STATE_EXTENSION, valueString: 'NJ' }],
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
  meta: { tag: [{ code: ERX_MEDICATION_META_TAG_CODE }] },
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  requester: { reference: 'Practitioner/prac-1' },
  medicationCodeableConcept: {
    coding: [{ system: MEDICATION_DISPENSABLE_DRUG_ID, code: '12345', display: 'Amoxicillin 500 mg capsule' }],
  },
  dosageInstruction: [{ patientInstruction: 'Take 1 capsule 3 times a day' }],
};

// The in-house medication order's MedicationRequest (create-update-medication-order): on the encounter too, but
// NOT a prescription — the eRx list is the erx-medication-tagged requests only.
const inHouseMedicationRequest: MedicationRequest = {
  resourceType: 'MedicationRequest',
  id: 'mr-inhouse',
  status: 'active',
  intent: 'order',
  meta: { tag: [{ code: 'in-house-medication' }] },
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  medicationCodeableConcept: { coding: [{ code: '99999', display: 'Ibuprofen 400 mg (in-house)' }] },
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

// A booked follow-up visit (convert-visit-to-follow-up): its own Appointment, status history and lock. It was
// signed through the regular flow, which writes no signature Provenance.
const scheduledFollowUpAppointment = appointment('appt-3', 'fulfilled', {
  start: '2026-07-01T16:00:00.000Z',
  meta: { tag: [{ code: OTTEHR_MODULE.IP }, APPOINTMENT_LOCKED_META_TAG] },
});

const scheduledFollowUpEncounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-3',
  status: 'finished',
  class: { code: 'AMB' },
  type: buildFollowupEncounterType('scheduled'),
  partOf: { reference: 'Encounter/enc-1' },
  appointment: [{ reference: 'Appointment/appt-3' }],
  subject: { reference: 'Patient/pat-1' },
  participant: [participant(PRACTITIONER_CODINGS.Attender, 'prac-1')],
  statusHistory: [
    visitStatusEntry('provider', '2026-07-01T16:00:00.000Z', '2026-07-01T16:20:00.000Z'),
    visitStatusEntry('completed', '2026-07-01T16:30:00.000Z'),
  ],
};

// A yes/no screening question answered by staff: the chart saves it as valueBoolean.
const radioScreeningField = patientScreeningQuestionsConfig.fields.find((f) => f.type === 'radio')!;

const booleanScreeningAnswer: Observation = {
  resourceType: 'Observation',
  id: 'obs-scr-bool',
  status: 'final',
  code: { text: radioScreeningField.fhirField },
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  effectiveDateTime: '2026-07-01T14:06:00.000Z',
  valueBoolean: true,
};

// A resolved phone follow-up added to enc-1 (save-followup-encounter: the parent's appointment reference).
const phoneFollowUp: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1-fu',
  status: 'finished',
  class: { code: 'AMB' },
  type: buildFollowupEncounterType('annotation'),
  partOf: { reference: 'Encounter/enc-1' },
  appointment: [{ reference: 'Appointment/appt-1' }],
  subject: { reference: 'Patient/pat-1' },
  period: { start: '2026-07-02T10:00:00.000Z', end: '2026-07-02T10:15:00.000Z' },
  reasonCode: [{ coding: [{ display: 'Result - Lab' }] }],
};

// The external lab's specimen, collected in the clinic by the intake nurse.
const labSpecimen: FhirResource = {
  resourceType: 'Specimen',
  id: 'spec-1',
  subject: { reference: 'Patient/pat-1' },
  request: [{ reference: 'ServiceRequest/sr-lab' }],
  collection: { collector: { reference: 'Practitioner/prac-2' }, collectedDateTime: '2026-07-01T14:13:00.000Z' },
};

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

// A second external lab on the cancelled visit, submitted later and with no Specimen of its own.
const secondExternalLabRequest: ServiceRequest = {
  ...externalLabRequest,
  id: 'sr-lab-2',
  encounter: { reference: 'Encounter/enc-2' },
  identifier: [{ system: OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM, value: 'REQ-2' }],
  code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: 'LIPID', display: 'Lipid panel' }] },
};

const secondPstTask: Task = { ...pstTask, id: 'task-pst-2', basedOn: [{ reference: 'ServiceRequest/sr-lab-2' }] };

const secondSubmitProvenance: Provenance = {
  ...submitProvenance,
  id: 'prov-submit-2',
  target: [{ reference: 'ServiceRequest/sr-lab-2' }],
  recorded: '2026-07-01T16:45:00.000Z',
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

// A completed nursing order: the complete-order Provenance names who completed it.
const completedNursingRequest: ServiceRequest = {
  ...nursingRequest,
  id: 'sr-nurse-2',
  status: 'completed',
  authoredOn: '2026-07-01T14:09:00.000Z',
  note: [{ text: 'Ice pack' }],
};

const completedNursingTask: Task = {
  ...nursingTask,
  id: 'task-nurse-2',
  status: 'completed',
  basedOn: [{ reference: 'ServiceRequest/sr-nurse-2' }],
};

const completedNursingProvenances: Provenance[] = [
  {
    ...nursingProvenance,
    id: 'prov-nurse-2-create',
    target: [{ reference: 'ServiceRequest/sr-nurse-2' }],
    recorded: '2026-07-01T14:09:00.000Z',
  },
  {
    resourceType: 'Provenance',
    id: 'prov-nurse-2-complete',
    target: [{ reference: 'ServiceRequest/sr-nurse-2' }],
    recorded: '2026-07-01T14:25:00.000Z',
    activity: { coding: [NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.completeOrder] },
    agent: [{ who: { reference: 'Practitioner/prac-2' } }],
  },
];

// Exam findings written by the chart's own writer (save-chart-data → makeExamObservationResource).
const examObservations: Observation[] = [
  { field: 'alert', value: true, label: 'Alert' },
  { field: 'mild-distress', value: true, label: 'Mild distress' },
  { field: 'soft', value: true, label: 'Soft' },
  { field: 'abdomen-comment', note: 'Mild guarding RLQ' },
].map((dto, i) => ({ ...makeExamObservationResource('enc-1', 'pat-1', dto, undefined, dto.label), id: `exam-${i}` }));

const resourcesByJob: Record<string, FhirResource[]> = {
  Appointment: [
    signedAppointment,
    cancelledAppointment,
    scheduledFollowUpAppointment,
    signedEncounter,
    cancelledEncounter,
    scheduledFollowUpEncounter,
    phoneFollowUp,
    patient,
    location,
  ],
  Practitioner: [attending, intakeNurse, supervisor],
  Provenance: [
    signatureProvenance('prov-author', 'author', 'prac-1', '2026-07-01T14:40:00.000Z'),
    signatureProvenance('prov-verifier', 'verifier', 'prac-3', '2026-07-01T15:00:00.000Z'),
    attending,
    supervisor,
  ],
  QuestionnaireResponse: [paperworkQr],
  'DocumentReference:related': [photoIdDocRef, conditionPhotoDocRef],
  DocumentReference: [dischargeSummary],
  Condition: [chiefComplaint, accidentCondition],
  ClinicalImpression: [medicalDecision],
  Communication: [instruction, intakeNote, addendum, deletedInternalNote],
  Procedure: [surgicalHistoryNote],
  ServiceRequest: [procedureRequest, externalLabRequest, nursingRequest, completedNursingRequest, dispositionFollowUp],
  HealthcareService: [group],
  Observation: [...vitals, booleanScreeningAnswer, ...examObservations],
  Patient: [patient, occMedAccount, accountEmployer],
  Organization: [preOpEmployer],
  MedicationAdministration: [
    vaccineOrder('ma-tdap', 'Tdap', 'in-progress'),
    vaccineOrder('ma-flu', 'Influenza', 'not-done', 'Patient declined'),
  ],
  // What an untagged MedicationRequest search would return — the dataset must ask for the eRx tag.
  MedicationRequest: [prescription, inHouseMedicationRequest],
  'MedicationRequest:erx': [prescription],
  'ServiceRequest:radiology': [statXray, attending],
  'ServiceRequest:orders': [
    externalLabRequest,
    secondExternalLabRequest,
    nursingRequest,
    completedNursingRequest,
    labSpecimen,
    pstTask,
    secondPstTask,
    nursingTask,
    completedNursingTask,
    submitProvenance,
    secondSubmitProvenance,
    nursingProvenance,
    ...completedNursingProvenances,
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
  if (
    resourceType === 'MedicationRequest' &&
    params.some((p) => p.name === '_tag' && p.value === ERX_MEDICATION_META_TAG_CODE)
  )
    return 'MedicationRequest:erx';
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
  includeFollowUp: true,
  includeIntake: true,
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
  includeDocuments: true,
  includeCodes: true,
};

describe('ad-hoc Encounters: layers mapped with the app mappers (fixture)', () => {
  it('rows parse against the schema', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, ...allLayers });
    expect(rows).toHaveLength(4);
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
    // The in-house order's MedicationRequest on the same encounter is not a prescription.
    expect(signed.drugs?.map((d) => d.name)).not.toContain('Ibuprofen 400 mg (in-house)');
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
        clinicalHistory: '',
        preliminaryReport: '',
        finalReport: '',
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

  it('scheduled follow-up: a visit of its own — status, start, lock and signer like any visit', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeSigning: true });
    const followUp = rows.find((r) => r.appointmentId === 'appt-3')!;
    expect(followUp).toMatchObject({
      encounterType: 'scheduled-follow-up',
      visitStatus: 'completed',
      startTime: '2026-07-01T16:00:00.000Z',
      signed: true,
      locked: true,
    });
    // No signature Provenance: the signer falls back to the attending, written like a Provenance signer.
    expect(followUp.signedBy).toBe(getProviderNameWithProfession(attending));
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.signedBy).toBe(getProviderNameWithProfession(attending));
  });

  it("intake: the patient's own paperwork answers, as the chart's patient column shows them", async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeIntake: true });
    const signed = rows.find((r) => r.encounterId === 'enc-1')!;
    expect(signed.patientScreeningAnswers).toEqual([
      { question: paperworkScreeningField.question, answer: paperworkScreeningOption.label },
    ]);
    expect(signed.patientScreeningQuestions).toEqual([paperworkScreeningField.question]);
  });

  it('follow-up: note details on the follow-up row, the note count on the visit row', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeFollowUp: true });
    expect(rows.find((r) => r.encounterId === 'enc-1')).toMatchObject({ followUpNoteCount: 1, followUpStatus: null });
    expect(rows.find((r) => r.encounterId === 'enc-1-fu')).toMatchObject({
      encounterType: 'follow-up',
      followUpNoteCount: 0,
      followUpReason: 'Result - Lab',
      followUpStatus: 'RESOLVED',
      followUpResolvedAt: '2026-07-02T10:15:00.000Z',
    });
  });

  it('intake: a yes/no screening answer reads as the chart shows it', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeIntake: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.screeningAnswers).toContainEqual({ question: radioScreeningField.question, answer: 'Yes' });
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
    expect(signed.consentComplete).toBe(true);
    expect(signed.consentMethod).toBe('paperwork');
    // The signer as the face sheet's consent section prints it.
    expect(signed.consentSignerName).toBe('Mary Doe');
    expect(signed.consentSignerRelationship).toBe('Parent');
    const cancelled = rows.find((r) => r.appointmentId === 'appt-2')!;
    expect(cancelled.consentSignerName).toBe('');
  });

  it('charting: reason for visit, verified flag, notes and addenda through the chart note DTO', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeCharting: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.chartReasonForVisit).toBe('Sore throat, fever since Monday');
    expect(signed.patientInfoConfirmed).toBe(true);
    expect(signed.surgicalHistoryNote).toBe('Tonsils out at age 5');
    expect(signed.patientInstructions).toEqual(['Rest and fluids']);
    // The deleted internal note is left out of the section notes; the addendum is listed apart.
    expect(signed.chartNotes).toEqual([
      { type: 'intake', text: 'Pt arrived with mother', author: 'Nina Park', addedAt: '2026-07-01T14:02:00.000Z' },
    ]);
    expect(signed.chartNoteCount).toBe(1);
    expect(signed.addenda).toEqual([
      {
        text: 'Culture came back negative',
        author: 'Nina Park',
        addedAt: '2026-07-02T09:00:00.000Z',
        edited: false,
        deleted: false,
      },
    ]);
    expect(signed.addendumCount).toBe(1);
    const cancelled = rows.find((r) => r.appointmentId === 'appt-2')!;
    expect(cancelled).toMatchObject({
      chartNotes: [],
      addenda: [],
      patientInfoConfirmed: false,
      chartReasonForVisit: '',
    });
  });

  it('intake: accident record as the visit note prints it, paperwork details shown during the visit', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeIntake: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.accidentTypes).toEqual(['Auto Accident', 'Other Accident']);
    expect(signed.accidentType).toBe('Auto Accident');
    expect(signed.accidentDate).toBe('2026-06-28');
    expect(signed.accidentState).toBe('NJ');
    expect(signed.personAccompanyingMinor).toBe('Mary Doe');
    expect(signed.hearingImpairedRelayPhone).toBe('(555) 010-0199');
    const cancelled = rows.find((r) => r.appointmentId === 'appt-2')!;
    expect(cancelled).toMatchObject({
      accidentTypes: [],
      accidentDate: null,
      accidentState: '',
      personAccompanyingMinor: '',
    });
  });

  it('documents: patient condition photos counted per visit (Appointment-related)', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeDocuments: true });
    expect(rows.find((r) => r.appointmentId === 'appt-1')!.patientConditionPhotoCount).toBe(1);
    expect(rows.find((r) => r.appointmentId === 'appt-2')!.patientConditionPhotoCount).toBe(0);
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
      collectedAt: '2026-07-01T14:13:00.000Z',
      collectedBy: 'Ivy Lee',
      reviewedAt: null,
      reviewedBy: '',
    });
    expect(signed.labTestNames).toEqual(['Complete blood count']);
    expect(signed.labNames).toEqual(['Quest']);
    // The other visit's order carries ITS OWN submit time (not the first submit Provenance of the report), its
    // requisition number, and — with no Specimen — still maps instead of failing the report.
    const cancelled = rows.find((r) => r.appointmentId === 'appt-2')!;
    expect(cancelled.labTests).toHaveLength(1);
    expect(cancelled.labTests?.[0]).toMatchObject({
      name: 'Complete blood count',
      status: 'sent',
      submittedAt: '2026-07-01T16:45:00.000Z',
      orderNumber: 'REQ-2',
      collectedAt: null,
      collectedBy: '',
    });
    expect(signed.labTests?.[0].orderNumber).toBe('');
    expect(signed.nursingOrderDetails).toEqual([
      {
        order: 'Rapid strep swab',
        status: 'pending',
        orderedAt: '2026-07-01T14:08:00.000Z',
        orderedBy: 'Nina Park',
        completedAt: null,
        completedBy: '',
      },
      {
        order: 'Ice pack',
        status: 'completed',
        orderedAt: '2026-07-01T14:09:00.000Z',
        orderedBy: 'Nina Park',
        completedAt: '2026-07-01T14:25:00.000Z',
        completedBy: 'Ivy Lee',
      },
    ]);
  });

  it('exam: findings per section with the abnormal flag and section comments, as on the visit note', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange, includeExamRos: true });
    const signed = rows.find((r) => r.appointmentId === 'appt-1')!;
    expect(signed.examFindingDetails).toEqual([
      { system: 'General Appearance', finding: 'Alert', abnormal: false },
      { system: 'General Appearance', finding: 'Mild distress', abnormal: true },
      { system: 'Abdomen', finding: 'Soft', abnormal: false },
    ]);
    expect(signed.examAbnormalSystems).toEqual(['General Appearance']);
    expect(signed.examAbnormalFindingCount).toBe(1);
    expect(signed.examComments).toEqual([{ system: 'Abdomen', comment: 'Mild guarding RLQ' }]);
  });

  it('base: the tracking-board staff note', async () => {
    const rows = await fetchAdHocEncounterRows(fakeOystehr, { dateRange });
    expect(rows.find((r) => r.appointmentId === 'appt-1')!.trackingBoardNote).toBe('Mom waiting in lobby');
    expect(rows.find((r) => r.appointmentId === 'appt-2')!.trackingBoardNote).toBe('');
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
