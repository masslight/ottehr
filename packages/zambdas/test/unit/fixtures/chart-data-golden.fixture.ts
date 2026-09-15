/**
 * Golden chart fixture: one encounter carrying at least one of every chart field the chart sections
 * return, built with the same `make*Resource` builders save-chart-data uses so the resources are
 * shaped exactly like production data.
 *
 * Tests that use it must freeze the clock first — several builders stamp `now` onto the resources:
 *   vi.useFakeTimers({ now: new Date(GOLDEN_NOW), toFake: ['Date'] });
 */
import {
  Appointment,
  Communication,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FhirResource,
  MedicationRequest,
  MedicationStatement,
  Patient,
  Practitioner,
  ServiceRequest,
} from 'fhir/r4b';
import {
  AMBIENT_SCRIBE_RECORDING_PENDING_CODING,
  ERX_MEDICATION_META_TAG_CODE,
  PRESCRIPTION_ERX_PHARMACY_ID_URL,
  PRIVATE_EXTENSION_BASE_URL,
  PUBLIC_EXTENSION_BASE_URL,
} from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE } from 'utils/lib/types/api/appointment.types';
import {
  AiObservationField,
  SCHOOL_WORK_NOTE_TYPE_META_SYSTEM,
  VitalFieldNames,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  ADDITIONAL_QUESTIONS_META_SYSTEM,
  AI_OBSERVATION_META_SYSTEM,
  NOTE_TYPE,
  ObservationBooleanFieldDTO,
  PATIENT_VITALS_META_SYSTEM,
  ProcedureDTO,
  VitalsTemperatureObservationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { createCodeableConcept } from 'utils/lib/types/api/chart-data/exam-fields-map';
import { MEDICATION_DISPENSABLE_DRUG_ID } from 'utils/lib/types/api/medication-administration.constants';
import { SCHOOL_WORK_NOTE, SCHOOL_WORK_NOTE_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { ObservationTextFieldDTO } from 'utils/lib/types/data/screening-questions/types';
import {
  createAccidentCondition,
  createDispositionServiceRequest,
  createProcedureServiceRequest,
  followUpToPerformerMap,
  makeAllergyResource,
  makeBirthHistoryObservationResource,
  makeClinicalImpressionResource,
  makeCommunicationResource,
  makeConditionResource,
  makeDiagnosisConditionResource,
  makeExamObservationResource,
  makeHospitalizationResource,
  makeMedicationResource,
  makeNoteResource,
  makeObservationResource,
  makeProcedureResource,
  makeRosObservationResource,
  makeServiceRequestResource,
} from '../../../src/shared/chart-data';
import { fillMeta } from '../../../src/shared/helpers';

export const GOLDEN_NOW = '2026-01-15T12:00:00.000Z';

export const GOLDEN_IDS = {
  encounterId: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222',
  practitionerId: '33333333-3333-4333-8333-333333333333',
  appointmentId: '44444444-4444-4444-8444-444444444444',
};

/** A second patient whose resources must never surface in the golden patient's chart. */
export const FOREIGN_IDS = {
  encounterId: '55555555-5555-4555-8555-555555555555',
  patientId: '66666666-6666-4666-8666-666666666666',
};

export interface GoldenChartResources {
  encounter: Encounter;
  patient: Patient;
  practitioner: Practitioner;
  appointment: Appointment;
  /** Every chart resource, the encounter and the practitioner included. The patient is kept separate. */
  resources: FhirResource[];
}

const { encounterId, patientId, practitionerId, appointmentId } = GOLDEN_IDS;

export function buildGoldenChartResources(): GoldenChartResources {
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: encounterId,
    status: 'in-progress',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    subject: { reference: `Patient/${patientId}` },
    appointment: [{ reference: `Appointment/${appointmentId}` }],
    participant: [
      {
        type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND' }] }],
        individual: { reference: `Practitioner/${practitionerId}` },
      },
    ],
    extension: [
      { url: 'patient-info-confirmed', valueBoolean: true },
      { url: 'add-to-visit-note', valueBoolean: true },
      { url: 'addendum-note', valueString: 'Legacy single-string addendum' },
      { url: 'reason-for-visit', valueString: 'Sore throat' },
    ],
    hospitalization: {
      dischargeDisposition: {
        coding: [{ code: 'pcp', system: `${PRIVATE_EXTENSION_BASE_URL}/discharge-disposition` }],
        text: 'Follow up with PCP in 3 days',
      },
    },
    diagnosis: [
      { condition: { reference: 'Condition/dx-primary' }, rank: 1 },
      { condition: { reference: 'Condition/dx-secondary' } },
    ],
  };

  const patient: Patient = {
    resourceType: 'Patient',
    id: patientId,
    name: [{ given: ['Golden'], family: 'Patient' }],
    birthDate: '2015-06-01',
    gender: 'female',
    contained: [
      {
        resourceType: 'Organization',
        id: 'pharmacy-1',
        name: 'Walgreens #100',
        address: [{ text: '1 Main St, Chicago, IL 60601' }],
        telecom: [{ system: 'phone', value: '312-555-0100' }],
      },
    ],
  };

  const practitioner: Practitioner = {
    resourceType: 'Practitioner',
    id: practitionerId,
    name: [{ given: ['Golden'], family: 'Provider', suffix: ['MD'] }],
  };

  const appointment: Appointment = {
    resourceType: 'Appointment',
    id: appointmentId,
    status: 'fulfilled',
    start: '2026-01-15T10:30:00.000Z',
    end: '2026-01-15T10:45:00.000Z',
    participant: [{ actor: { reference: `Patient/${patientId}` }, status: 'accepted' }],
    meta: { tag: [{ code: OTTEHR_MODULE.IP }] },
  };

  const freeText = (id: string, text: string, field: Parameters<typeof makeConditionResource>[3]): FhirResource =>
    makeConditionResource(encounterId, patientId, { resourceId: id, text }, field);

  const note = (type: NOTE_TYPE): Communication => {
    const resource = makeNoteResource(
      encounterId,
      patientId,
      {
        type,
        resourceId: `note-${type}`,
        text: `${type} note text`,
        authorId: practitionerId,
        authorName: 'Golden Provider',
        patientId,
        encounterId,
      },
      undefined
    );
    // FHIR stamps lastUpdated server-side; equal to `sent` means the note was never edited.
    resource.meta = { ...resource.meta, lastUpdated: GOLDEN_NOW };
    return resource;
  };

  const inHouseMedication: MedicationStatement = {
    resourceType: 'MedicationStatement',
    id: 'ms-in-house',
    status: 'completed',
    subject: { reference: `Patient/${patientId}` },
    context: { reference: `Encounter/${encounterId}` },
    effectiveDateTime: '2026-01-15T11:05:00.000Z',
    medicationCodeableConcept: {
      coding: [{ system: MEDICATION_DISPENSABLE_DRUG_ID, code: 'ihm-200', display: 'Ibuprofen 200 mg' }],
    },
    dosage: [{ doseAndRate: [{ doseQuantity: { value: 200, unit: 'mg' } }] }],
    meta: fillMeta('in-house-medication', 'in-house-medication'),
  };

  const prescribedMedication: MedicationRequest = {
    resourceType: 'MedicationRequest',
    id: 'mr-erx',
    status: 'active',
    intent: 'order',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    requester: { reference: `Practitioner/${practitionerId}` },
    medicationCodeableConcept: {
      coding: [{ system: MEDICATION_DISPENSABLE_DRUG_ID, code: 'rx-10', display: 'Cetirizine 10 mg tablet' }],
    },
    dosageInstruction: [{ patientInstruction: 'Take one tablet daily' }],
    identifier: [{ system: 'https://identifiers.fhir.oystehr.com/erx-prescription-id', value: 'rx-abc-123' }],
    extension: [{ url: PRESCRIPTION_ERX_PHARMACY_ID_URL, valueInteger: 42 }],
    meta: { ...fillMeta(ERX_MEDICATION_META_TAG_CODE, ERX_MEDICATION_META_TAG_CODE), lastUpdated: GOLDEN_NOW },
  };

  const dispositionFollowUp = createDispositionServiceRequest({
    disposition: { type: 'pcp', note: 'Follow up with PCP in 3 days', followUpIn: 3 },
    encounterId,
    followUpId: 'sr-disposition-follow-up',
    patientId,
  }).resource as ServiceRequest;

  const subFollowUp = makeServiceRequestResource({
    resourceId: 'sr-sub-follow-up-ent',
    encounterId,
    patientId,
    metaName: 'sub-follow-up',
    code: createCodeableConcept(
      [{ system: 'http://snomed.info/sct', code: '185389009', display: 'Follow-up visit (procedure)' }],
      'Follow-up visit (procedure)'
    ),
    performerType: followUpToPerformerMap.ent,
    note: 'ENT if symptoms persist',
  });

  const procedureDTO: ProcedureDTO = {
    resourceId: 'sr-procedure',
    procedureType: 'laceration-repair',
    procedureDateTime: '2026-01-15T11:00:00.000Z',
    documentedDateTime: '2026-01-15T11:30:00.000Z',
    performerType: 'provider',
    bodySite: 'arm',
    bodySide: 'left',
    technique: ['simple'],
    consentObtained: true,
    diagnoses: [
      { resourceId: 'dx-primary', code: 'J02.9', display: 'Acute pharyngitis, unspecified', isPrimary: false },
    ],
    cptCodes: [{ resourceId: 'proc-cpt-12001', code: '12001', display: 'Simple repair of superficial wounds' }],
  };
  const procedureServiceRequest = createProcedureServiceRequest(procedureDTO, encounterId, patientId)
    .resource as ServiceRequest;

  const schoolWorkNote: DocumentReference = {
    resourceType: 'DocumentReference',
    id: 'dr-school-note',
    status: 'current',
    docStatus: 'final',
    type: {
      coding: [{ system: 'http://loinc.org', code: SCHOOL_WORK_NOTE_CODE, display: 'School/Work note' }],
      text: 'School/Work note',
    },
    date: GOLDEN_NOW,
    subject: { reference: `Patient/${patientId}` },
    context: { encounter: [{ reference: `Encounter/${encounterId}` }] },
    content: [{ attachment: { url: 'https://z3.example/visit-notes/school-note.pdf', title: 'School note' } }],
    meta: {
      tag: [
        { code: 'school', system: SCHOOL_WORK_NOTE_TYPE_META_SYSTEM },
        ...(fillMeta(SCHOOL_WORK_NOTE, SCHOOL_WORK_NOTE).tag ?? []),
      ],
    },
  };

  const aiConsultNote: DocumentReference = {
    resourceType: 'DocumentReference',
    id: 'dr-ai-consult-note',
    status: 'current',
    type: { coding: [VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE] },
    date: GOLDEN_NOW,
    subject: { reference: `Patient/${patientId}` },
    context: { encounter: [{ reference: `Encounter/${encounterId}` }] },
    content: [{ attachment: { url: 'https://z3.example/ai/consult-note.json', title: 'AI consult note' } }],
    extension: [
      { url: `${PUBLIC_EXTENSION_BASE_URL}/provider`, valueReference: { reference: `Practitioner/${practitionerId}` } },
    ],
  };

  const aiPendingRecording: DocumentReference = {
    resourceType: 'DocumentReference',
    id: 'dr-ai-pending-recording',
    status: 'current',
    type: { coding: [AMBIENT_SCRIBE_RECORDING_PENDING_CODING] },
    date: GOLDEN_NOW,
    subject: { reference: `Patient/${patientId}` },
    context: { encounter: [{ reference: `Encounter/${encounterId}` }] },
    content: [{ attachment: { url: 'https://z3.example/ai/recording.webm', title: 'Recording' } }],
  };

  const radiologyOrder: ServiceRequest = {
    resourceType: 'ServiceRequest',
    id: 'sr-radiology',
    status: 'active',
    intent: 'order',
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    requester: { reference: `Practitioner/${practitionerId}` },
    code: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '73030', display: 'X-ray shoulder' }] },
    reasonCode: [{ coding: [{ code: 'S43.401A', display: 'Unspecified sprain of right shoulder joint' }] }],
    meta: fillMeta('radiology', 'radiology'),
  };

  const radiologyFinalReport: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: 'dr-radiology-final',
    status: 'final',
    code: { text: 'X-ray shoulder' },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    basedOn: [{ reference: 'ServiceRequest/sr-radiology' }],
    issued: '2026-01-15T11:50:00.000Z',
    presentedForm: [{ contentType: 'text/html', data: Buffer.from('<p>No acute fracture.</p>').toString('base64') }],
  };

  const temperature: VitalsTemperatureObservationDTO = {
    resourceId: 'obs-vital-temperature',
    field: VitalFieldNames.VitalTemperature,
    value: 38.2,
  };

  const resources: FhirResource[] = [
    encounter,
    practitioner,
    // encounter-scoped free-text fields
    freeText('cond-chief-complaint', 'Sore throat for 3 days', 'chief-complaint'),
    freeText('cond-hpi', 'Gradual onset, worse with swallowing', 'history-of-present-illness'),
    freeText('cond-moi', 'No injury', 'mechanism-of-injury'),
    freeText('cond-ros', 'Negative except as noted', 'ros'),
    createAccidentCondition(
      { resourceId: 'cond-accident', type: ['AA'], date: '2026-01-10', state: 'IL' },
      encounterId,
      patientId
    ).resource,
    // patient-level history
    makeConditionResource(
      encounterId,
      patientId,
      { resourceId: 'cond-asthma', code: 'J45.909', display: 'Unspecified asthma, uncomplicated', current: true },
      'medical-condition'
    ),
    makeAllergyResource(
      encounterId,
      patientId,
      { resourceId: 'allergy-penicillin', id: '1001', name: 'Penicillin', current: true, note: 'hives' },
      'known-allergy'
    ),
    makeMedicationResource(
      encounterId,
      patientId,
      practitionerId,
      {
        resourceId: 'ms-current-albuterol',
        id: 'med-albuterol',
        name: 'Albuterol inhaler',
        status: 'active',
        type: 'as-needed',
        intakeInfo: { date: '2026-01-14', dose: '2 puffs' },
      },
      'current-medication'
    ),
    inHouseMedication,
    prescribedMedication,
    makeProcedureResource(
      encounterId,
      patientId,
      { resourceId: 'proc-surgical-tonsillectomy', code: '42820', display: 'Tonsillectomy and adenoidectomy' },
      'surgical-history'
    ),
    makeProcedureResource(
      encounterId,
      patientId,
      { resourceId: 'proc-surgical-history-note', text: 'Uncomplicated recovery' },
      'surgical-history-note'
    ),
    makeHospitalizationResource(
      patientId,
      { resourceId: 'eoc-pneumonia', code: 'hospitalization', display: 'Pneumonia (2024)' },
      'hospitalization'
    ),
    makeBirthHistoryObservationResource(
      encounterId,
      patientId,
      { resourceId: 'obs-birth-weight', field: 'weight', value: 3.4, note: 'Term delivery' },
      'birth-history'
    ),
    // assessment
    makeDiagnosisConditionResource(
      encounterId,
      patientId,
      { resourceId: 'dx-primary', code: 'J02.9', display: 'Acute pharyngitis, unspecified', isPrimary: true },
      'diagnosis'
    ),
    makeDiagnosisConditionResource(
      encounterId,
      patientId,
      { resourceId: 'dx-secondary', code: 'R50.9', display: 'Fever, unspecified', isPrimary: false },
      'diagnosis'
    ),
    makeProcedureResource(
      encounterId,
      patientId,
      { resourceId: 'proc-cpt-99213', code: '99213', display: 'Office visit, established patient, low' },
      'cpt-code'
    ),
    makeProcedureResource(
      encounterId,
      patientId,
      { resourceId: 'proc-cpt-12001', code: '12001', display: 'Simple repair of superficial wounds' },
      'cpt-code'
    ),
    makeProcedureResource(
      encounterId,
      patientId,
      { resourceId: 'proc-em-99214', code: '99214', display: 'Office visit, established patient, moderate' },
      'em-code'
    ),
    makeClinicalImpressionResource(
      encounterId,
      patientId,
      { resourceId: 'ci-mdm', text: 'Viral pharyngitis, low complexity decision making' },
      'medical-decision'
    ),
    procedureServiceRequest,
    // plan
    makeCommunicationResource(
      encounterId,
      patientId,
      { resourceId: 'comm-instruction', title: 'Home care', text: 'Rest, fluids, ibuprofen as needed' },
      'patient-instruction'
    ),
    dispositionFollowUp,
    subFollowUp,
    schoolWorkNote,
    // exam, ROS, screening, AI and vitals observations
    makeExamObservationResource(
      encounterId,
      patientId,
      { resourceId: 'obs-exam-general', field: 'normal-general', value: true, note: 'Well appearing' },
      undefined,
      'General'
    ),
    makeRosObservationResource(encounterId, patientId, {
      resourceId: 'obs-ros-fever',
      field: 'ros-fever',
      value: true,
      label: 'Fever',
    }),
    makeObservationResource(
      encounterId,
      patientId,
      practitionerId,
      undefined,
      { resourceId: 'obs-screening-covid', field: 'covid-symptoms', value: true } as ObservationBooleanFieldDTO,
      ADDITIONAL_QUESTIONS_META_SYSTEM
    ),
    makeObservationResource(
      encounterId,
      patientId,
      practitionerId,
      undefined,
      {
        resourceId: 'obs-screening-travel',
        field: 'travel-usa',
        value: 'No recent travel',
        note: 'Asked on intake',
      } as ObservationTextFieldDTO,
      ADDITIONAL_QUESTIONS_META_SYSTEM
    ),
    makeObservationResource(
      encounterId,
      patientId,
      practitionerId,
      undefined,
      {
        resourceId: 'obs-ai-hpi',
        field: AiObservationField.HistoryOfPresentIllness,
        value: 'Patient reports three days of sore throat.',
      } as ObservationTextFieldDTO,
      AI_OBSERVATION_META_SYSTEM
    ),
    makeObservationResource(
      encounterId,
      patientId,
      practitionerId,
      undefined,
      temperature,
      PATIENT_VITALS_META_SYSTEM,
      patient.birthDate,
      patient.gender
    ),
    // notes of every type
    ...Object.values(NOTE_TYPE)
      .filter((type) => type !== NOTE_TYPE.UNKNOWN)
      .map(note),
    // AI chat documents
    aiConsultNote,
    aiPendingRecording,
    // radiology
    radiologyOrder,
    radiologyFinalReport,
  ];

  return { encounter, patient, practitioner, appointment, resources };
}

/**
 * Resources belonging to a different patient, carrying the same chart tags. The DTO mapper matches on
 * tags rather than on patient, so only the searches keep them out of the golden patient's chart.
 */
export function buildForeignPatientResources(): FhirResource[] {
  const foreignNote = makeNoteResource(
    FOREIGN_IDS.encounterId,
    FOREIGN_IDS.patientId,
    {
      type: NOTE_TYPE.VITALS,
      resourceId: 'foreign-note-vitals',
      text: 'Another patient vitals note',
      authorId: practitionerId,
      authorName: 'Golden Provider',
      patientId: FOREIGN_IDS.patientId,
      encounterId: FOREIGN_IDS.encounterId,
    },
    undefined
  );
  foreignNote.meta = { ...foreignNote.meta, lastUpdated: GOLDEN_NOW };
  return [
    makeAllergyResource(
      FOREIGN_IDS.encounterId,
      FOREIGN_IDS.patientId,
      { resourceId: 'foreign-allergy', name: 'Latex', current: true },
      'known-allergy'
    ),
    foreignNote,
    makeConditionResource(
      FOREIGN_IDS.encounterId,
      FOREIGN_IDS.patientId,
      { resourceId: 'foreign-chief-complaint', text: 'Another patient complaint' },
      'chief-complaint'
    ),
  ];
}
