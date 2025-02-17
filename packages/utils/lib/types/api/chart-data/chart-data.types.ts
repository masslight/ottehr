import { MedicationRequest, MedicationStatement, Practitioner, Reference, Resource } from 'fhir/r4b';
import {
  ASQ_FIELD,
  ASQKeys,
  HISTORY_OBTAINED_FROM_FIELD,
  HistorySourceKeys,
  RecentVisitKeys,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
  VitalBloodPressureObservationMethod,
  VitalFieldNames,
  VitalHeartbeatObservationMethod,
  VitalsOxygenSatObservationMethod,
  VitalTemperatureObservationMethod,
} from './chart-data.constants';
import {
  ExamCardsNames,
  ExamFieldsNames,
  InPersonExamCardsNames,
  InPersonExamFieldsNames,
} from './save-chart-data.types';
import { GetChartDataResponse } from './get-chart-data.types';

export interface ChartDataFields {
  chiefComplaint?: FreeTextNoteDTO;
  ros?: FreeTextNoteDTO;
  conditions?: MedicalConditionDTO[];
  medications?: MedicationDTO[];
  prescribedMedications?: PrescribedMedicationDTO[];
  allergies?: AllergyDTO[];
  procedures?: CPTCodeDTO[];
  proceduresNote?: FreeTextNoteDTO;
  observations?: ObservationDTO[];
  examObservations?: ExamObservationDTO[];
  medicalDecision?: ClinicalImpressionDTO;
  cptCodes?: CPTCodeDTO[];
  emCode?: CPTCodeDTO;
  instructions?: CommunicationDTO[];
  disposition?: DispositionDTO;
  episodeOfCare?: HospitalizationDTO[];
  diagnosis?: DiagnosisDTO[];
  patientInfoConfirmed?: BooleanValueDTO;
  addToVisitNote?: BooleanValueDTO;
  addendumNote?: FreeTextNoteDTO;
  notes?: NoteDTO[];
  vitalsObservations?: VitalsObservationDTO[];
  birthHistory?: BirthHistoryDTO[];
}

export type ChartDataFieldsKeys = keyof ChartDataFields;

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
  type: 'scheduled' | 'as-needed';
  id?: string;
  practitioner?: Practitioner | Reference;
}

export interface MedicationIntakeInfo {
  date?: string;
  dose: string;
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

export const PATIENT_VITALS_META_SYSTEM = 'patient-vitals-field';

export const NOTHING_TO_EAT_OR_DRINK_ID = 'nothing-to-eat-or-drink'; // fhir url
export const NOTHING_TO_EAT_OR_DRINK_FIELD = 'nothingToEatOrDrink'; // backend/frontend - disposition field & form field
export const NOTHING_TO_EAT_OR_DRINK_LABEL = 'Nothing to eat or drink until evaluated in the Emergency Department.'; // frontend form label

export const PATIENT_INSTRUCTIONS_TEMPLATE_CODE = 'patient-instruction-template';

export const CSS_NOTE_ID = 'css-note';

export interface ExamObservationDTO extends SaveableDTO {
  field: ExamFieldsNames | ExamCardsNames | InPersonExamFieldsNames | InPersonExamCardsNames;
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
}
export interface VitalsWeightObservationDTO extends VitalsBaseObservationDTO {
  field: Extract<VitalFieldNames, 'vital-weight'>;
  value: number;
}

export interface VitalsHeightObservationDTO extends VitalsBaseObservationDTO {
  field: Extract<VitalFieldNames, 'vital-height'>;
  value: number;
}

export interface VitalsTemperatureObservationDTO extends VitalsBaseObservationDTO {
  field: Extract<VitalFieldNames, 'vital-temperature'>;
  value: number;
  observationMethod?: VitalTemperatureObservationMethod;
}

export interface VitalsHeartbeatObservationDTO extends VitalsBaseObservationDTO {
  field: Extract<VitalFieldNames, 'vital-heartbeat'>;
  value: number;
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
  leftEyeVisionValue: number;
  rightEyeVisionValue: number;
  extraVisionOptions?: VitalsVisionOption[];
}

export interface VitalsOxygenSatObservationDTO extends VitalsBaseObservationDTO {
  field: Extract<VitalFieldNames, 'vital-oxygen-sat'>;
  value: number;
  observationMethod?: VitalsOxygenSatObservationMethod;
}

export interface VitalsRespirationRateObservationDTO extends VitalsBaseObservationDTO {
  field: Extract<VitalFieldNames, 'vital-respiration-rate'>;
  value: number;
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

export type ObservationDTO = ObservationTextFieldDTO | ObservationBooleanFieldDTO | VitalsObservationDTO;

export interface ObservationBooleanFieldDTO extends SaveableDTO {
  field: string;
  value?: boolean;
}

export type ObservationTextFieldDTO =
  | ObservationHistoryObtainedFromDTO
  | ObservationSeenInLastThreeYearsDTO
  | ASQObservationDTO;

export type ObservationHistoryObtainedFromDTO =
  | CustomOptionObservationHistoryObtainedFromDTO
  | ListOptionObservationHistoryObtainedFromDTO;

export type CustomOptionObservationHistoryObtainedFromDTO = {
  field: typeof HISTORY_OBTAINED_FROM_FIELD;
  value: HistorySourceKeys.NotObtainedOther;
  note: string;
} & SaveableDTO;

export type ListOptionObservationHistoryObtainedFromDTO = {
  field: typeof HISTORY_OBTAINED_FROM_FIELD;
  value: Exclude<HistorySourceKeys, HistorySourceKeys.NotObtainedOther>;
} & SaveableDTO;

export type ObservationSeenInLastThreeYearsDTO = {
  field: typeof SEEN_IN_LAST_THREE_YEARS_FIELD;
  value: RecentVisitKeys;
} & SaveableDTO;

export type ASQObservationDTO = {
  field: typeof ASQ_FIELD;
  value: ASQKeys;
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

export type DispositionType = 'ip' | 'ip-lab' | 'pcp' | 'ed' | 'ip-oth' | 'pcp-no-type' | 'another' | 'speciality';

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
  snomedDescription: string;
  snomedRegionDescription: string;
}

export interface DiagnosisDTO extends SaveableDTO {
  code: string;
  display: string;
  isPrimary: boolean;
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

export type ExamTabCardNames =
  | 'vitals'
  | 'general'
  | 'head'
  | 'eyes'
  | 'nose'
  | 'ears'
  | 'mouth'
  | 'neck'
  | 'chest'
  | 'back'
  | 'skin'
  | 'abdomen'
  | 'musculoskeletal'
  | 'neurological'
  | 'psych';

export type InPersonExamTabProviderCardNames =
  | 'general'
  | 'skin'
  | 'hair'
  | 'nails'
  | 'head'
  | 'eyes'
  | 'ears'
  | 'nose'
  | 'mouth'
  | 'teeth'
  | 'pharynx'
  | 'neck'
  | 'heart'
  | 'lungs'
  | 'abdomen'
  | 'back'
  | 'rectal'
  | 'extremities'
  | 'musculoskeletal'
  | 'neurologic'
  | 'psychiatric';

export const IN_PERSON_EXAM_CARDS: InPersonExamTabProviderCardNames[] = [
  'general',
  'skin',
  'hair',
  'nails',
  'head',
  'eyes',
  'ears',
  'nose',
  'mouth',
  'teeth',
  'pharynx',
  'neck',
  'heart',
  'lungs',
  'abdomen',
  'back',
  'rectal',
  'extremities',
  'musculoskeletal',
  'neurologic',
  'psychiatric',
];

export type ExamTabProviderCardNames = Exclude<ExamTabCardNames, 'vitals'>;

export type ExamTabGroupNames =
  | 'normal'
  | 'abnormal'
  | 'rightEye'
  | 'leftEye'
  | 'rightEar'
  | 'leftEar'
  | 'form'
  | 'dropdown';

export type ExamObservationFieldItem = {
  field: ExamFieldsNames;
  defaultValue: boolean;
  abnormal: boolean;
  group: ExamTabGroupNames;
  card: ExamTabProviderCardNames;
  label: string;
};

export type InPersonExamObservationFieldItem = {
  field: InPersonExamFieldsNames;
  defaultValue: boolean;
  abnormal: boolean;
  group: ExamTabGroupNames;
  card: InPersonExamTabProviderCardNames;
  label: string;
};

const defaultNotes: Record<DispositionType, string> = {
  ip: 'Please proceed to the In Person Office as advised.',
  'ip-lab':
    'Please proceed to the In Person Office for a lab as advised.\nIf symptoms do not improve, please go to the A. Emergency Department Office, B. Urgent Care Office.',
  pcp: 'Please see your Primary Care Physician.',
  ed: 'Please go to the Emergency Department immediately.',
  'ip-oth': 'Please go to an In Person Office.',
  'pcp-no-type': 'Please see your Primary Care Physician as discussed.',
  another: 'Please proceed to the ABC Office as advised.',
  speciality: '',
};

export const getDefaultNote = (dispositionType: DispositionType): string => {
  return defaultNotes[dispositionType];
};
