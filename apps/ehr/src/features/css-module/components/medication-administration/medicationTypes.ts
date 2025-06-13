import { MedicationOrderStatusesType } from 'utils';

export interface MedicationHistoryItem {
  id: string;
  name: string;
  dose: number;
  provider: string;
  date: string;
}

export type Option = { value: string; label: string };

export enum ReasonListCodes {
  PATIENT_REFUSED = 'patient-refused',
  CARE_GIVER_REFUSED = 'caregiver-refused',
  NOT_APPROPRIATE_AT_THIS_TIME = 'not-appropriate-at-this-time',
  // cSpell:disable-next didnt
  PATIENT_DID_NOT_TOLERATE_MEDICATION = 'patient-didnt-tolerate-medication',
  OTHER = 'other',
}

export const reasonListValues: Record<ReasonListCodes, string> = {
  [ReasonListCodes.PATIENT_REFUSED]: 'Patient refused',
  [ReasonListCodes.CARE_GIVER_REFUSED]: 'Caregiver refused',
  [ReasonListCodes.NOT_APPROPRIATE_AT_THIS_TIME]: 'Not appropriate at this time',
  [ReasonListCodes.PATIENT_DID_NOT_TOLERATE_MEDICATION]: "Patient didn't tolerate medication",
  [ReasonListCodes.OTHER]: 'Other',
};

export const statusTransitions: Record<MedicationOrderStatusesType, MedicationOrderStatusesType[]> = {
  pending: ['administered-partly', 'administered-not', 'administered', 'cancelled'],
  'administered-partly': [],
  'administered-not': [],
  administered: [],
  cancelled: [],
};
