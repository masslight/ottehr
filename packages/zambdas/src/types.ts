export enum CancellationReasonCodes {
  'Duplicate Visit or Account Error' = 'duplicate-visit-account-error',
  'Financial Responsibility Concern' = 'financial-concern',
  'Non-par or inactive insurance' = 'inactive-insurance',
  'Patient improved' = 'patient-improved',
  'Wait Time' = 'wait-time',
  'Went to outside facility' = 'outside-facility',
}

export enum CancellationReasonOptions {
  'Duplicate Visit or Account Error' = 'Duplicate Visit or Account Error',
  'Financial Responsibility Concern' = 'Financial Responsibility Concern',
  'Non-par or inactive insurance' = 'Non-par or inactive insurance',
  'Patient improved' = 'Patient improved',
  'Wait Time' = 'Wait Time',
  'Went to outside facility' = 'Went to outside facility',
}

export enum PatientEthnicity {
  'Hispanic/Latino' = 'Hispanic/Latino',
  'Not Hispanic/Latino' = 'Not Hispanic/Latino',
  'Prefer not to answer' = 'Prefer not to answer',
}

export const PatientEthnicityCode = {
  'Hispanic/Latino': '2135-2',
  'Not Hispanic/Latino': '2186-5',
  'Prefer not to answer': undefined,
};

export type PatientInfo = {
  id: string | undefined;
  newPatient: boolean;
  firstName: string | undefined;
  lastName: string | undefined;
  dateOfBirth: string | undefined;
  sex: PatientSex | undefined;
  ethnicity: PatientEthnicity | undefined;
  race: PatientRace | undefined;
  reasonForVisit: string[] | undefined;
};

export enum PatientRace {
  'American Indian or Alaskan Native' = 'American Indian or Alaskan Native',
  'Asian' = 'Asian',
  'Black or African American' = 'Black or African American',
  'Hawaiian or Pacific Islander' = 'Hawaiian or Pacific Islander',
  'Other' = 'Other',
  'Prefer not to answer' = 'Prefer not to answer',
  'Unknown' = 'Unknown',
  'White' = 'White',
}

export const PatientRaceCode = {
  'American Indian or Alaskan Native': '1002-5',
  Asian: '2028-9',
  'Black or African American': '2054-5',
  'Hawaiian or Pacific Islander': '2076-8',
  Other: '2131-1',
  'Prefer not to answer': undefined,
  Unknown: undefined,
  White: '2106-3',
};

export enum PatientSex {
  Male = 'male',
  Female = 'female',
  Other = 'other',
}

export interface Secrets {
  [secretName: string]: string;
}

export interface ZambdaInput {
  headers: any | null;
  body: string | null;
  secrets: Secrets | null;
}
