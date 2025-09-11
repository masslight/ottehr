import {
  AllergyIntolerance,
  ClinicalImpression,
  Communication,
  Condition,
  DocumentReference,
  EpisodeOfCare,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Practitioner,
  Procedure,
  QuestionnaireResponse,
  Reference,
  Resource,
  ServiceRequest,
} from 'fhir/r4b';
import { ObservationDTO } from 'utils';
import { EncounterExternalLabResult, EncounterInHouseLabResult } from '../lab';
import {
  AiObservationField,
  ASQ_FIELD,
  ASQKeys,
  VitalAlertCriticality,
  VitalBloodPressureObservationMethod,
  VitalFieldNames,
  VitalHeartbeatObservationMethod,
  VitalsOxygenSatObservationMethod,
  VitalTemperatureObservationMethod,
} from './chart-data.constants';
import { GetChartDataResponse } from './get-chart-data.types';

export interface ChartDataFields {
  chiefComplaint?: FreeTextNoteDTO;
  ros?: FreeTextNoteDTO;
  conditions?: MedicalConditionDTO[];
  medications?: MedicationDTO[];
  inhouseMedications?: MedicationDTO[];
  prescribedMedications?: PrescribedMedicationDTO[];
  allergies?: AllergyDTO[];
  surgicalHistory?: CPTCodeDTO[];
  surgicalHistoryNote?: FreeTextNoteDTO;
  observations?: ObservationDTO[];
  examObservations?: ExamObservationDTO[];
  medicalDecision?: ClinicalImpressionDTO;
  cptCodes?: CPTCodeDTO[];
  emCode?: CPTCodeDTO;
  instructions?: CommunicationDTO[];
  disposition?: DispositionDTO;
  episodeOfCare?: HospitalizationDTO[];
  diagnosis?: DiagnosisDTO[];
  aiPotentialDiagnosis?: DiagnosisDTO[];
  patientInfoConfirmed?: BooleanValueDTO;
  addToVisitNote?: BooleanValueDTO;
  addendumNote?: FreeTextNoteDTO;
  notes?: NoteDTO[];
  vitalsObservations?: VitalsObservationDTO[];
  birthHistory?: BirthHistoryDTO[];
  aiChat?: QuestionnaireResponse;
  externalLabResults?: EncounterExternalLabResult;
  inHouseLabResults?: EncounterInHouseLabResult;
  procedures?: ProcedureDTO[];
}

export type ChartDataFieldsKeys = keyof ChartDataFields;

export type ChartDataResources =
  | AllergyIntolerance
  | ClinicalImpression
  | Communication
  | Condition
  | DocumentReference
  | MedicationStatement
  | Observation
  | Procedure
  | ServiceRequest
  | EpisodeOfCare;

export interface ChartDataWithResources {
  chartData: GetChartDataResponse;
  chartResources: Resource[];
}

export interface SaveableDTO {
  resourceId?: string;
}

export interface FreeTextNoteDTO extends SaveableDTO {
  text?: string;
}

export interface BooleanValueDTO {
  value?: boolean;
}

export interface MedicalConditionDTO extends SaveableDTO {
  code?: string;
  display?: string;
  note?: string;
  current?: boolean;
}

export interface MedicationDTO extends SaveableDTO {
  name: string;
  status: Extract<MedicationStatement['status'], 'active' | 'completed'>;
  intakeInfo: MedicationIntakeInfo;
  type: 'scheduled' | 'as-needed' | 'prescribed-medication';
  id?: string;
  practitioner?: Practitioner | Reference;
}

export interface MedicationIntakeInfo {
  date?: string;
  dose?: string;
}

export interface PrescribedMedicationDTO extends SaveableDTO {
  name?: string;
  instructions?: string;
  status?: MedicationRequest['status'] | 'loading';
  provider?: string;
  added?: string;
  prescriptionId?: string;
}

export interface AllergyDTO extends SaveableDTO {
  // type:
  //   | Exclude<ArrayInnerType<WithRequired<AllergyIntolerance, 'category'>['category']>, 'biologic' | 'environment'>
  //   | 'other';
  id?: string;
  name?: string;
  note?: string;
  current?: boolean;
}

export const EXAM_OBSERVATION_META_SYSTEM = 'exam-observation-field';
export const ADDITIONAL_QUESTIONS_META_SYSTEM = 'additional-questions-field';
export const AI_OBSERVATION_META_SYSTEM = 'ai-observation';
export const PATIENT_VITALS_META_SYSTEM = 'patient-vitals-field';
export const NOTHING_TO_EAT_OR_DRINK_ID = 'nothing-to-eat-or-drink'; // fhir url
export const NOTHING_TO_EAT_OR_DRINK_FIELD = 'nothingToEatOrDrink'; // backend/frontend - disposition field & form field
export const NOTHING_TO_EAT_OR_DRINK_LABEL = 'Nothing to eat or drink until evaluated in the Emergency Department.'; // frontend form label
export const PATIENT_INSTRUCTIONS_TEMPLATE_CODE = 'patient-instruction-template';
export const CSS_NOTE_ID = 'css-note';

export interface ExamObservationDTO extends SaveableDTO {
  field: string;
  note?: string;
  value?: boolean;
}
export interface VitalsBaseObservationDTO extends SaveableDTO {
  field: VitalFieldNames;
  resourceId?: string;
  patientId?: string;
  encounterId?: string;
  authorId?: string;
  authorName?: string;
  lastUpdated?: string;
  alertCriticality?: VitalAlertCriticality;
}
export interface VitalsNumericValueObservationDTO extends VitalsBaseObservationDTO {
  value: number;
}
export interface VitalsWeightObservationDTO extends VitalsNumericValueObservationDTO {
  field: Extract<VitalFieldNames, 'vital-weight'>;
}

export interface VitalsHeightObservationDTO extends VitalsNumericValueObservationDTO {
  field: Extract<VitalFieldNames, 'vital-height'>;
}

export interface VitalsTemperatureObservationDTO extends VitalsNumericValueObservationDTO {
  field: Extract<VitalFieldNames, 'vital-temperature'>;
  observationMethod?: VitalTemperatureObservationMethod;
}

export interface VitalsHeartbeatObservationDTO extends VitalsNumericValueObservationDTO {
  field: Extract<VitalFieldNames, 'vital-heartbeat'>;
  observationMethod?: VitalHeartbeatObservationMethod;
}

export interface VitalsBloodPressureObservationDTO extends VitalsBaseObservationDTO {
  field: Extract<VitalFieldNames, 'vital-blood-pressure'>;
  value?: never;
  systolicPressure: number;
  diastolicPressure: number;
  observationMethod?: VitalBloodPressureObservationMethod;
}

export type VitalsVisionOption = 'child_too_young' | 'with_glasses' | 'without_glasses';

export interface VitalsVisionObservationDTO extends VitalsBaseObservationDTO {
  field: Extract<VitalFieldNames, 'vital-vision'>;
  value?: never;
  leftEyeVisionText: string;
  rightEyeVisionText: string;
  extraVisionOptions?: VitalsVisionOption[];
}

export interface VitalsOxygenSatObservationDTO extends VitalsNumericValueObservationDTO {
  field: Extract<VitalFieldNames, 'vital-oxygen-sat'>;
  observationMethod?: VitalsOxygenSatObservationMethod;
}

export interface VitalsRespirationRateObservationDTO extends VitalsNumericValueObservationDTO {
  field: Extract<VitalFieldNames, 'vital-respiration-rate'>;
}

export type VitalsObservationDTO =
  | VitalsTemperatureObservationDTO
  | VitalsHeartbeatObservationDTO
  | VitalsBloodPressureObservationDTO
  | VitalsOxygenSatObservationDTO
  | VitalsRespirationRateObservationDTO
  | VitalsWeightObservationDTO
  | VitalsHeightObservationDTO
  | VitalsVisionObservationDTO;

export interface ObservationBooleanFieldDTO extends SaveableDTO {
  field: string;
  value?: boolean;
}

export type ASQObservationDTO = {
  field: typeof ASQ_FIELD;
  value: ASQKeys;
} & SaveableDTO;

export type AiObservationDTO = {
  field: typeof AiObservationField;
  value: string;
} & SaveableDTO;

export interface CPTCodeDTO extends SaveableDTO {
  code: string;
  display: string;
}

export interface ClinicalImpressionDTO extends SaveableDTO {
  text?: string;
}

export interface CommunicationDTO extends SaveableDTO {
  text?: string;
}

export enum NOTE_TYPE {
  INTERNAL = 'internal',
  INTAKE = 'intake',
  VITALS = 'vitals',
  SCREENING = 'screening',
  MEDICATION = 'medication',
  ALLERGY = 'allergy',
  INTAKE_MEDICATION = 'intake-medication',
  MEDICAL_CONDITION = 'medical-condition',
  SURGICAL_HISTORY = 'surgical-history',
  HOSPITALIZATION = 'hospitalization',
  UNKNOWN = 'unknown',
}

export interface NoteDTO extends CommunicationDTO {
  type: NOTE_TYPE;
  resourceId?: string;
  patientId: string;
  encounterId: string;
  text: string;
  authorId: string;
  authorName: string;
  lastUpdated?: string; // system generated, not sent from frontend
}

export type DispositionType = 'ip' | 'ip-lab' | 'pcp' | 'ed' | 'ip-oth' | 'pcp-no-type' | 'another' | 'specialty';

export type DispositionFollowUpType = 'dentistry' | 'ent' | 'ophthalmology' | 'orthopedics' | 'other' | 'lurie-ct';

export interface DispositionDTO {
  type: DispositionType;
  note: string;
  reason?: string;
  labService?: string[];
  virusTest?: string[];
  followUp?: {
    type: DispositionFollowUpType;
    note?: string;
  }[];
  followUpIn?: number;
  [NOTHING_TO_EAT_OR_DRINK_FIELD]?: boolean;
}

export interface HospitalizationDTO extends SaveableDTO {
  code: string;
  display: string;
}

export interface DiagnosisDTO extends SaveableDTO {
  code: string;
  display: string;
  isPrimary: boolean;
  addedViaLabOrder?: boolean;
}

export interface BirthHistoryDTO extends SaveableDTO {
  field: 'age' | 'weight' | 'length' | 'preg-compl' | 'del-compl';
  value?: number;
  flag?: boolean;
  note?: string;
}

export const SCHOOL_NOTE_CODE = 'school';
export const WORK_NOTE_CODE = 'work';
export type SchoolWorkNoteType = typeof SCHOOL_NOTE_CODE | typeof WORK_NOTE_CODE;

export interface SchoolWorkNoteExcuseDocDTO {
  documentHeader: string;
  parentGuardianName: string;
  headerNote: string;
  bulletItems?: PdfBulletPointItem[];
  footerNote: string;
  providerDetails: SchoolWorkNoteExcuseDocProviderDetails;
  type: SchoolWorkNoteType;
}

export interface SchoolWorkNoteExcuseDocProviderDetails {
  name: string;
  credentials: string;
}

export interface SchoolWorkNoteExcuseDocFileDTO {
  id: string;
  published?: boolean;
  date?: string;
  name?: string;
  url?: string;
  type: SchoolWorkNoteType;
}

export interface PdfBulletPointItem {
  text: string;
  subItems?: PdfBulletPointItem[];
}

const defaultNotes: Record<DispositionType, string> = {
  ip: 'Please proceed to the In Person Office as advised.',
  'ip-lab':
    'Please proceed to the In Person Office for a lab as advised.\nIf symptoms do not improve, please go to the A. Emergency Department Office, B. Urgent Care Office.',
  pcp: 'Please see your Primary Care Physician.',
  ed: 'Please go to the Emergency Department immediately.',
  'ip-oth': 'Please go to an In Person Office.',
  'pcp-no-type': 'Please see your Primary Care Physician as discussed.',
  another: 'Please proceed to the ABC Office as advised.',
  specialty: '',
};

export const getDefaultNote = (dispositionType: DispositionType): string => {
  return defaultNotes[dispositionType];
};

export const followUpInOptions = [
  {
    label: '1 day',
    value: 1,
  },
  {
    label: '2 days',
    value: 2,
  },
  {
    label: '3 days',
    value: 3,
  },
  {
    label: '4 days',
    value: 4,
  },
  {
    label: '5 days',
    value: 5,
  },
  {
    label: '1 week',
    value: 7,
  },
  {
    label: '2 weeks',
    value: 14,
  },
  {
    label: 'as needed',
    value: 0,
  },
];

export interface ProcedureDTO extends SaveableDTO {
  procedureType?: string;
  cptCodes?: CPTCodeDTO[];
  diagnoses?: DiagnosisDTO[];
  procedureDateTime?: string;
  documentedDateTime?: string;
  performerType?: string;
  medicationUsed?: string;
  bodySite?: string;
  bodySide?: string;
  technique?: string;
  suppliesUsed?: string;
  procedureDetails?: string;
  specimenSent?: boolean;
  complications?: string;
  patientResponse?: string;
  postInstructions?: string;
  timeSpent?: string;
  documentedBy?: string;
  consentObtained?: boolean;
}
