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

export enum VisitType {
  WalkIn = 'walkin',
  PreBook = 'prebook',
}

export enum CancellationReasonOptions {
  'Patient improved' = 'Patient improved',
  'Wait time too long' = 'Wait time too long',
  'Prefer another urgent care provider' = 'Prefer another urgent care provider',
  'Changing location' = 'Changing location',
  'Changing to telemedicine' = 'Changing to telemedicine',
  'Financial responsibility concern' = 'Financial responsibility concern',
  'Insurance issue' = 'Insurance issue',
}

export const CancellationReasonCodes = {
  'Patient improved': 'patient-improved',
  'Wait time too long': 'wait-time',
  'Prefer another urgent care provider': 'prefer-another-provider',
  'Changing location': 'changing-location',
  'Changing to telemedicine': 'changing-telemedicine',
  'Financial responsibility concern': 'financial-concern',
  'Insurance issue': 'insurance-issue',
};

export type PatientInfo = {
  id: string | undefined;
  newPatient: boolean;
  firstName: string | undefined;
  lastName: string | undefined;
  dateOfBirth: string | undefined;
  sex: PersonSex | undefined;
  email: string | undefined;
  emailUser: 'Patient' | 'Parent/Guardian' | undefined;
  reasonForVisit: string[] | undefined;
  phoneNumber: string | undefined;
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

export type FormItemType =
  | 'Text'
  | 'Select'
  | 'Radio'
  | 'Radio List'
  | 'Free Select'
  | 'Date'
  | 'File'
  | 'Checkbox'
  | 'Header 3'
  | 'Description'
  | undefined;

export interface PaperworkPage {
  page: string;
  reviewPageName?: string;
  slug: string;
  questions: Question[];
}

export interface Question {
  id: string;
  text: string;
  type: FormItemType;
  multiline?: boolean;
  minRows?: number;
  placeholder?: string;
  infoText?: string;
  infoTextSecondary?: string;
  required?: boolean;
  width?: number;
  options?: string[];
  attachmentText?: string;
  format?: string;
  docType?: string;
  enableWhen?: {
    question: string;
    operator: QuestionOperator;
    answer: string;
  };
  requireWhen?: {
    question: string;
    operator: QuestionOperator;
    answer: string;
  };
}

export type QuestionOperator = 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<=' | undefined;

export interface FileURLs {
  [key: string]: {
    z3Url?: string;
    presignedUrl?: string;
  };
}

export interface ConsentSigner {
  signature: string;
  fullName: string;
  relationship: string;
}
