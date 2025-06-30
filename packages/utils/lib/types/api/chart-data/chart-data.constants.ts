import { SCHOOL_WORK_NOTE } from '../../data';
import { CSS_NOTE_ID, NOTHING_TO_EAT_OR_DRINK_ID } from './chart-data.types';

export type ProviderChartDataFieldsNames =
  | 'chief-complaint'
  | 'ros'
  | 'current-medication'
  | 'in-house-medication'
  | 'prescribed-medication'
  | 'known-allergy'
  | 'medical-condition'
  | 'surgical-history'
  | 'surgical-history-note'
  | 'hospitalization'
  | 'additional-question'
  | 'medical-decision'
  | 'cpt-code'
  | 'em-code'
  | 'patient-instruction'
  | 'diagnosis'
  | typeof SCHOOL_WORK_NOTE
  | 'patient-info-confirmed'
  | 'addendum-note'
  | typeof NOTHING_TO_EAT_OR_DRINK_ID
  | typeof CSS_NOTE_ID
  | 'birth-history'
  | 'ai-potential-diagnosis'
  | 'procedure';

export type DispositionMetaFieldsNames = 'disposition-follow-up' | 'sub-follow-up';

export const SCHOOL_WORK_NOTE_TYPE_META_SYSTEM = `${SCHOOL_WORK_NOTE}/type`;

export const PATIENT_SUPPORT_PHONE_NUMBER = '202-555-1212';

export const HISTORY_OBTAINED_FROM_FIELD = 'history-obtained-from';

export const SEEN_IN_LAST_THREE_YEARS_FIELD = 'seen-in-last-three-years';

export enum HistorySourceKeys {
  Mother = 'mother',
  Father = 'father',
  Guardian = 'guardian',
  PatientSelf = 'patient-self',
  StepParent = 'step-parent',
  Grandmother = 'grandmother',
  Grandfather = 'grandfather',
  Brother = 'brother',
  Sister = 'sister',
  Wife = 'wife',
  Husband = 'husband',
  SignificantOther = 'significant-other',
  Aunt = 'aunt',
  Uncle = 'uncle',
  Cousin = 'cousin',
  Caretaker = 'caretaker',
  Babysitter = 'babysitter',
  Nanny = 'nanny',
  Friend = 'friend',
  Neighbor = 'neighbor',
  EMTWorker = 'emt',
  PoliceOfficer = 'police',
  SocialWorker = 'social-worker',
  Bystander = 'bystander',
  SchoolNurse = 'school-nurse',
  NotObtainedEmergency = 'not-obtained-emergency',
  NotObtainedOther = 'not-obtained-other',
}

export enum RecentVisitKeys {
  Yes = 'yes',
  No = 'no',
  NotApplicable = 'na',
  PreferNotToAnswer = 'prefer-not-answer',
}

export const ASQ_FIELD = 'asq';

export enum ASQKeys {
  Negative = 'Negative',
  Positive = 'Positive',
  Declined = 'Declined',
  NotOffered = 'NotOffered',
}

export const asqLabels: Record<ASQKeys, string> = {
  [ASQKeys.Negative]: 'Negative',
  [ASQKeys.Positive]: 'Positive',
  [ASQKeys.Declined]: 'Patient/Caregiver Declined',
  [ASQKeys.NotOffered]: 'Not offered',
};

export const historySourceLabels: Record<HistorySourceKeys, string> = {
  [HistorySourceKeys.Mother]: 'Mother',
  [HistorySourceKeys.Father]: 'Father',
  [HistorySourceKeys.Guardian]: 'Guardian',
  [HistorySourceKeys.PatientSelf]: 'Patient self-reported',
  [HistorySourceKeys.StepParent]: 'Step-parent',
  [HistorySourceKeys.Grandmother]: 'Grandmother',
  [HistorySourceKeys.Grandfather]: 'Grandfather',
  [HistorySourceKeys.Brother]: 'Brother',
  [HistorySourceKeys.Sister]: 'Sister',
  [HistorySourceKeys.Wife]: 'Wife',
  [HistorySourceKeys.Husband]: 'Husband',
  [HistorySourceKeys.SignificantOther]: 'Significant other',
  [HistorySourceKeys.Aunt]: 'Aunt',
  [HistorySourceKeys.Uncle]: 'Uncle',
  [HistorySourceKeys.Cousin]: 'Cousin',
  [HistorySourceKeys.Caretaker]: 'Caretaker',
  [HistorySourceKeys.Babysitter]: 'Babysitter',
  [HistorySourceKeys.Nanny]: 'Nanny',
  [HistorySourceKeys.Friend]: 'Friend',
  [HistorySourceKeys.Neighbor]: 'Neighbor',
  [HistorySourceKeys.EMTWorker]: 'EMT Worker',
  [HistorySourceKeys.PoliceOfficer]: 'Police Officer',
  [HistorySourceKeys.SocialWorker]: 'Social Worker',
  [HistorySourceKeys.Bystander]: 'Bystander',
  [HistorySourceKeys.SchoolNurse]: 'School Nurse',
  [HistorySourceKeys.NotObtainedEmergency]: 'History not obtained due to emergency situation',
  [HistorySourceKeys.NotObtainedOther]: 'History not obtained due to other reason',
};

export const SEEN_IN_LAST_THREE_YEARS_LABEL =
  'Has the patient been seen in one of our offices / telemed in last 3 years?';

export const recentVisitLabels: Record<RecentVisitKeys, string> = {
  [RecentVisitKeys.Yes]: 'Yes',
  [RecentVisitKeys.No]: 'No',
  [RecentVisitKeys.NotApplicable]: 'N/A',
  [RecentVisitKeys.PreferNotToAnswer]: 'Prefer not to answer',
};

export function getHistorySourceLabel(key: HistorySourceKeys): string {
  return historySourceLabels[key];
}

export function getRecentVisitLabel(key: RecentVisitKeys): string {
  return recentVisitLabels[key];
}

export enum VitalFieldNames {
  VitalTemperature = 'vital-temperature',
  VitalHeartbeat = 'vital-heartbeat',
  VitalBloodPressure = 'vital-blood-pressure',
  VitalOxygenSaturation = 'vital-oxygen-sat',
  VitalRespirationRate = 'vital-respiration-rate',
  VitalWeight = 'vital-weight',
  VitalHeight = 'vital-height',
  VitalVision = 'vital-vision',
}

export enum VitalTemperatureObservationMethod {
  Oral = 'Oral',
  Rectal = 'Rectal',
}

export enum VitalHeartbeatObservationMethod {
  Sitting = 'Sitting',
  Standing = 'Standing',
  Supine = 'Supine',
}

export enum VitalBloodPressureObservationMethod {
  Sitting = 'Sitting',
  Standing = 'Standing',
  Supine = 'Supine',
}

export enum VitalsOxygenSatObservationMethod {
  OnRoomAir = 'On room air',
  OnSupplementalO2 = 'On supplemental O2',
}

export enum AiObservationField {
  HistoryOfPresentIllness = 'ai-history-of-present-illness',
  PastMedicalHistory = 'ai-past-medical-history',
  PastSurgicalHistory = 'ai-past-surgical-history',
  MedicationsHistory = 'ai-medications-history',
  SocialHistory = 'ai-social-history',
  FamilyHistory = 'ai-family-history',
  HospitalizationsHistory = 'ai-hospitalizations-history',
  Allergies = 'ai-allergies',
}
