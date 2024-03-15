import { Question } from 'ottehr-utils';

export const PatientEthnicityCode = {
  'Hispanic or Latino': '2135-2',
  'Not Hispanic or Latino': '2186-5',
  'Decline to Specify': undefined,
};

export const PatientRaceCode = {
  'American Indian or Alaska Native': '1002-5',
  Asian: '2028-9',
  'Black or African American': '2054-5',
  'Native Hawaiian or Other Pacific Islander': '2076-8',
  White: '2106-3',
  'Decline to Specify': undefined,
};

export enum PersonSex {
  male = 'male',
  female = 'female',
  other = 'other',
}

export enum CancellationReasonOptions {
  'Patient improved' = 'Patient improved',
  'Wait time too long' = 'Wait time too long',
  'Prefer another urgent care provider' = 'Prefer another urgent care provider',
  'Financial responsibility concern' = 'Financial responsibility concern',
  'Insurance issue' = 'Insurance issue',
  'Duplicate visit or account error' = 'Duplicate visit or account error',
}

export const CancellationReasonCodes = {
  'Patient improved': 'patient-improved',
  'Wait time too long': 'wait-time',
  'Prefer another urgent care provider': 'prefer-another-provider',
  'Financial responsibility concern': 'financial-concern',
  'Insurance issue': 'insurance-issue',
  'Duplicate visit or account error': 'duplicate-visit-or-account-error',
};

export enum PatientEthnicity {
  'Hispanic or Latino' = 'Hispanic or Latino',
  'Not Hispanic or Latino' = 'Not Hispanic or Latino',
  'Decline to Specify' = 'Decline to Specify',
}

export enum PatientRace {
  'American Indian or Alaska Native' = 'American Indian or Alaska Native',
  'Asian' = 'Asian',
  'Black or African American' = 'Black or African American',
  'Native Hawaiian or Other Pacific Islander' = 'Native Hawaiian or Other Pacific Islander',
  'White' = 'White',
  'Decline to Specify' = 'Decline to Specify',
}

export interface PaperworkPage {
  page: string;
  reviewPageName?: string;
  slug: string;
  questions: Question[];
}

export interface PaperworkPage {
  page: string;
  reviewPageName?: string;
  slug: string;
  questions: Question[];
}

export interface FileURLs {
  [key: string]: {
    z3Url?: string;
    presignedUrl?: string;
  };
}

export interface InsuranceRequestParameters {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  memberId: string;
  insurance: string;
  sex: PersonSex;
  relationship: RelationshipToInsured;
  additionalInfo?: string;
  insuranceCardFrontUrl?: string;
  insuranceCardBackUrl?: string;
}

export enum RelationshipToInsured {
  child = 'child',
  parent = 'parent',
  mother = 'mother',
  father = 'father',
  sibling = 'sibling',
  spouse = 'spouse',
  other = 'other',
}
