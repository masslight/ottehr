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

export enum ErrorCodes {
  // 10 000: General
  unexpected = 10_001,
  reload = 10_002,
  unauthorized = 10_003,
  timedOut = 10_004,
  notFound = 10_005,
  duplicate = 10_006,
  unauthorizedByThirdParty = 10_007,
  // 11 000: Failed action
  couldNotJoin = 11_001,
  couldNotCreate = 11_002,
  couldNotUpdate = 11_003,
  couldNotDelete = 11_004,
  couldNotSync = 11_005,
  // 20 000: Validation - must match
  mustBeNotEmpty = 20_001,
  mustBeString = 20_002,
  mustBeLetters = 20_003,
  mustBeNumber = 20_004,
  mustBeAlphanumeric = 20_005,
  mustBeAlphanumericWithSpaces = 20_006,
  mustBePhone = 20_007,
  mustBeEmail = 20_008,
  mustBeUuid = 20_009,
  mustBeDate = 20_010,

  mustMatchList = 20_101,
  mustPassPasswordChecks = 20_102,
  // 21 0000: Validation - missing
  missingRequired = 21_001,
  missingProperties = 21_002,
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
  dateOfBirth: string | undefined;
  ethnicity: PatientEthnicity | undefined;
  firstName: string | undefined;
  id: string | undefined;
  lastName: string | undefined;
  newPatient: boolean;
  race: PatientRace | undefined;
  reasonForVisit: string[] | undefined;
  sex: PatientSex | undefined;
};

export enum Title {
  Assistant = 'Assistant',
  Dr = 'Dr',
  Mr = 'Mr',
  Mrs = 'Mrs',
  Ms = 'Ms',
  Nurse = 'Nurse',
}

export type ProviderInfo = {
  checkboxes: boolean;
  email: string;
  firstName: string;
  lastName: string;
  slug: string;
  title: Title;
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
  Female = 'female',
  Male = 'male',
  Other = 'other',
}

export interface Secrets {
  [secretName: string]: string;
}

export interface ZambdaFunctionInput {
  body: Record<string, any>;
  secrets: Secrets | null;
}

/**
 * Mutually exclusive. Return only one.
 *
 * @example
 * ```tsx
 * function DummyZambdaFunction(input) {
 *   const age = input.age;
 *
 *   if (isNaN(age)) {
 *     return { error: '"age" must be a number.' };
 *   }
 *
 *   const isAdult = age > 18;
 *   return {
 *     response: {
 *       isAdult,
 *     }
 *   };
 * }
 * ```
 */
export interface ZambdaFunctionResponse {
  error?: ErrorCodes;
  response?: Record<string, any>;
}

export interface ZambdaInput {
  body: string | null;
  headers: any | null;
  secrets: Secrets | null;
}

export interface FormData {
  acceptTerms: boolean;
  email: string;
  firstName: string;
  lastName: string;
  notPatient: boolean;
  password: string;
  slug: string;
  title: string;
}
