export type ProviderChartDataFieldsNames =
  | 'chief-complaint'
  | 'ros'
  | 'current-medication'
  | 'known-allergy'
  | 'medical-condition'
  | 'surgical-history'
  | 'surgical-history-note'
  | 'additional-question'
  | 'medical-decision'
  | 'cpt-code'
  | 'patient-instruction'
  | 'diagnosis'
  | 'work-school-note'
  | 'patient-info-confirmed'
  | 'addendum-note';

export type DispositionMetaFieldsNames = 'disposition-follow-up' | 'sub-follow-up';

export const WORK_SCHOOL_NOTE_TYPE_META_SYSTEM = 'work-school-note/type';
