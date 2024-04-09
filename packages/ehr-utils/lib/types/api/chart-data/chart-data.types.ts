import { ExamCardsNames, ExamFieldsNames } from './save-chart-data.types';

import { AllergyIntolerance } from 'fhir/r4';
import { ArrayInnerType, WithRequired } from '../../utils';

export interface ChartDataFields {
  chiefComplaint?: MedicalConditionDTO;
  ros?: MedicalConditionDTO;
  conditions?: MedicalConditionDTO[];
  medications?: MedicationDTO[];
  allergies?: AllergyDTO[];
  procedures?: ProcedureDTO[];
  proceduresNote?: FreeTextNoteDTO;
  observations?: FreeTextNoteDTO;
  examObservations?: ExamObservationDTO[];
}

export interface SaveableDTO {
  resourceId?: string;
}

export interface FreeTextNoteDTO extends SaveableDTO {
  text?: string;
}

export interface MedicalConditionDTO extends SaveableDTO {
  description?: string;
}

export interface MedicationDTO extends SaveableDTO {
  name?: string;
}

export interface ProcedureDTO extends SaveableDTO {
  name?: string;
}

export interface AllergyDTO extends SaveableDTO {
  type:
    | Exclude<ArrayInnerType<WithRequired<AllergyIntolerance, 'category'>['category']>, 'biologic' | 'environment'>
    | 'other';
  agentOrSubstance?: string;
}

export interface ExamObservationDTO extends SaveableDTO {
  field: ExamFieldsNames | ExamCardsNames;
  note?: string;
  value?: boolean;
}

export const EXAM_OBSERVATION_META_SYSTEM = 'exam-observation-field';
