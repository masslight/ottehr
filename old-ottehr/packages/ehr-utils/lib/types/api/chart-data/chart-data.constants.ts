import { SCHOOL_WORK_NOTE } from '../../paperwork.constants';

export type ProviderChartDataFieldsNames =
  | 'chief-complaint'
  | 'ros'
  | 'current-medication'
  | 'prescribed-medication'
  | 'known-allergy'
  | 'medical-condition'
  | 'surgical-history'
  | 'surgical-history-note'
  | 'additional-question'
  | 'medical-decision'
  | 'cpt-code'
  | 'patient-instruction'
  | 'diagnosis'
  | typeof SCHOOL_WORK_NOTE
  | 'patient-info-confirmed'
  | 'addendum-note';

export type DispositionMetaFieldsNames = 'disposition-follow-up' | 'sub-follow-up';

export const SCHOOL_WORK_NOTE_TYPE_META_SYSTEM = `${SCHOOL_WORK_NOTE}/type`;
