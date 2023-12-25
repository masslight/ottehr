import { FhirClient, ZambdaClient } from '@zapehr/sdk';

export enum PatientEthnicity {
  'Hispanic/Latino' = 'Hispanic/Latino',
  'Not Hispanic/Latino' = 'Not Hispanic/Latino',
  'Prefer not to answer' = 'Prefer not to answer',
}

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

export enum PatientSex {
  Female = 'female',
  Male = 'male',
  Other = 'other',
}

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

export type ProviderInfo = {
  id: string | undefined;
  name: string | undefined;
};

export type ProviderData = {
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  slug: string;
  title: string;
};

export type Action =
  | { fhirClient: FhirClient; type: 'SET_FHIR_CLIENT' }
  | { patientInfo: PatientInfo | undefined; type: 'UPDATE_PATIENT' }
  | { type: 'SET_ZAMBDA_CLIENT'; zambdaClient: ZambdaClient };

export type State = {
  fhirClient?: FhirClient;
  patientInfo?: PatientInfo;
  zambdaClient?: ZambdaClient;
};

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
