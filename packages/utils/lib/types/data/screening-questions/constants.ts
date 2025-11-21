export const HISTORY_OBTAINED_FROM_FIELD = 'history-obtained-from';

export const SEEN_IN_LAST_THREE_YEARS_FIELD = 'seen-in-last-three-years'; // todo: move to config

export const PATIENT_VACCINATION_STATUS = 'patient-vaccination-status';

export enum PatientVaccinationKeys {
  yes = 'yes',
  partially = 'partially',
  no = 'no',
}

export const patientVaccinationLabels: Record<PatientVaccinationKeys, string> = {
  [PatientVaccinationKeys.yes]: 'Yes, up to date',
  [PatientVaccinationKeys.partially]: 'Partially vaccinated',
  [PatientVaccinationKeys.no]: 'No vaccinations',
};

export enum RecentVisitKeys {
  Yes = 'yes',
  No = 'no',
  NotApplicable = 'na',
  PreferNotToAnswer = 'prefer-not-answer',
}

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
