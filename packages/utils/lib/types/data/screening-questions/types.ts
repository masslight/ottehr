import { ASQObservationDTO, ObservationBooleanFieldDTO, SaveableDTO, VitalsObservationDTO } from '../../api';
import {
  HISTORY_OBTAINED_FROM_FIELD,
  HistorySourceKeys,
  PATIENT_VACCINATION_STATUS,
  PatientVaccinationKeys,
  RecentVisitKeys,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
} from './constants';

export interface ScreeningQuestionsConfig {
  title: string;
  fields: Field[];
}

export type FieldType = 'radio' | 'text' | 'textarea' | 'select' | 'dateRange';

export interface Option {
  value: string;
  label: string;
  fhirValue: string;
}

export interface NoteField {
  id: string;
  label: string;
  type: 'text' | 'textarea';
  placeholder?: string;
  fhirField: string;
  conditionalValue?: string; // Additional behavior for noteField - what parent field value activates noteField
}

export interface Field {
  id: string;
  type: FieldType;
  question: string;
  required?: boolean;
  options?: Option[];
  placeholder?: string;
  fhirField: string;
  noteField?: NoteField;

  // Behavioral flags
  debounced?: boolean; // Use debounce (default: false)
  canDelete?: boolean; // Can delete if value is empty (default: false)
  conditionalSave?: {
    // Conditional save - don't save immediately if certain value is selected
    waitForNote: string; // Value that triggers waiting for note
  };
}

export type ObservationDTO =
  | ObservationTextFieldDTO
  | ObservationBooleanFieldDTO
  | VitalsObservationDTO
  | ObservationDateRangeFieldDTO;

export type ObservationTextFieldDTO =
  | ObservationHistoryObtainedFromDTO
  | ObservationSeenInLastThreeYearsDTO
  | ASQObservationDTO
  | PatientVaccinationDTO;

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

export type PatientVaccinationDTO = {
  field: typeof PATIENT_VACCINATION_STATUS;
  value: PatientVaccinationKeys;
  note?: string;
} & SaveableDTO;

export type ObservationDateRangeFieldDTO = {
  field: string;
  value: [string, string];
} & SaveableDTO;
