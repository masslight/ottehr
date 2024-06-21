import { ExamCardsNames, ExamFieldsNames } from './save-chart-data.types';

export interface ChartDataFields {
  chiefComplaint?: FreeTextNoteDTO;
  ros?: FreeTextNoteDTO;
  conditions?: MedicalConditionDTO[];
  medications?: MedicationDTO[];
  allergies?: AllergyDTO[];
  procedures?: ProcedureDTO[];
  proceduresNote?: FreeTextNoteDTO;
  observations?: FreeTextNoteDTO;
  examObservations?: ExamObservationDTO[];
  medicalDecision?: ClinicalImpressionDTO;
  cptCodes?: CPTCodeDTO[];
  instructions?: CommunicationDTO[];
  disposition?: DispositionDTO;
  diagnosis?: DiagnosisDTO[];
  patientInfoConfirmed?: BooleanValueDTO;
  addendumNote?: FreeTextNoteDTO;
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
}

export interface MedicationDTO extends SaveableDTO {
  name?: string;
  id?: string;
}

export interface ProcedureDTO extends SaveableDTO {
  name?: string;
}

export interface AllergyDTO extends SaveableDTO {
  // type:
  //   | Exclude<ArrayInnerType<WithRequired<AllergyIntolerance, 'category'>['category']>, 'biologic' | 'environment'>
  //   | 'other';
  id?: string;
  name?: string;
}

export const EXAM_OBSERVATION_META_SYSTEM = 'exam-observation-field';

export interface ExamObservationDTO extends SaveableDTO {
  field: ExamFieldsNames | ExamCardsNames;
  note?: string;
  value?: boolean;
}

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

export type DispositionType = 'uc' | 'uc-lab' | 'pcp' | 'ed' | 'uc-oth';

export type DispositionFollowUpType = 'dentistry' | 'ent' | 'ophthalmology' | 'orthopedics' | 'other' | 'lurie-ct';

export interface DispositionDTO {
  type: DispositionType;
  note: string;
  labService?: string;
  virusTest?: string;
  followUp?: {
    type: DispositionFollowUpType;
    note?: string;
  }[];
  followUpIn?: number;
}

export interface DiagnosisDTO extends SaveableDTO {
  code: string;
  display: string;
  isPrimary: boolean;
}

export type WorkSchoolNoteType = 'work' | 'school';

export interface WorkSchoolNoteExcuseDocDTO {
  documentHeader: string;
  parentGuardianName: string;
  headerNote: string;
  bulletItems?: PdfBulletPointItem[];
  footerNote: string;
  providerDetails: WorkSchoolNoteExcuseDocProviderDetails;
  type: WorkSchoolNoteType;
}

export interface WorkSchoolNoteExcuseDocProviderDetails {
  name: string;
  credentials: string;
}

export interface WorkSchoolNoteExcuseDocFileDTO {
  id: string;
  published?: boolean;
  date?: string;
  name?: string;
  url?: string;
  type: WorkSchoolNoteType;
}

export interface PdfBulletPointItem {
  text: string;
  subItems?: PdfBulletPointItem[];
}
