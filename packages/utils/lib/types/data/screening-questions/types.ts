import { ASQObservationDTO, ObservationBooleanFieldDTO, SaveableDTO, VitalsObservationDTO } from '../../api';
import {
  HISTORY_OBTAINED_FROM_FIELD,
  HistorySourceKeys,
  PATIENT_VACCINATION_STATUS,
  PatientVaccinationKeys,
  RecentVisitKeys,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
} from './constants';

// Re-export config contract types from ottehr-types
export type {
  ScreeningConditionalSave,
  ScreeningField,
  ScreeningFieldOption,
  ScreeningFieldType,
  ScreeningNoteField,
  ScreeningQuestionsConfig,
} from 'ottehr-types';

// Backwards compatibility aliases for existing code
import type { ScreeningField, ScreeningFieldOption, ScreeningFieldType, ScreeningNoteField } from 'ottehr-types';

export type Field = ScreeningField;
export type FieldType = ScreeningFieldType;
export type Option = ScreeningFieldOption;
export type NoteField = ScreeningNoteField;

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
