import { Address, ContactPoint, LocationHoursOfOperation } from 'fhir/r4';
import { Secrets } from '../secrets';

export interface FileUpload {
  [key: string]: {
    fileData: File | null;
    uploadFailed: boolean;
  };
}

export interface FileURLs {
  [key: string]: {
    localUrl?: string;
    presignedUrl?: string;
    z3Url?: string;
  };
}
export interface AvailableLocationInformation {
  id: string | undefined;
  slug: string | undefined;
  name: string | undefined;
  description: string | undefined;
  address: Address | undefined;
  telecom: ContactPoint[] | undefined;
  hoursOfOperation: LocationHoursOfOperation[] | undefined;
  timezone: string | undefined;
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

export type PromiseReturnType<T> = T extends Promise<infer R> ? R : never;

export interface ConsentInfo {
  HIPAA: boolean;
  consentToTreat: boolean;
  signature: string;
  fullName: string;
  relationship: string;
}

export type UserType = 'Patient' | 'Parent/Guardian';

export interface ContactInfo {
  formUser?: UserType;
  patientNumber?: string;
  parentNumber?: string;
  patientEmail?: string;
  parentEmail?: string;
  streetAddressLine1?: string;
  streetAddressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface HealthcareContacts {
  ethnicity?: PatientEthnicity;
  race?: PatientRace;
  physicianFirstName?: string;
  physicianLastName?: string;
  physicianPhoneNumber?: string;
  pharmacyName?: string;
  pharmacyAddress?: string;
  pharmacyPhone?: string;
}

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

export interface ResponsiblePartyInfo {
  relationship: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  dateOfBirth: string;
  birthSex?: PersonSex;
  phoneNumber?: string;
}

export interface PhotoIdCards {
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  idCardFrontLocalUrl?: string;
  idCardBackLocalUrl?: string;
  idCardFrontPresignedUrl?: string;
  idCardBackPresignedUrl?: string;
}

export enum PersonSex {
  Male = 'male',
  Female = 'female',
  Intersex = 'other',
  Unknown = 'unknown',
}

export interface ZambdaInput {
  headers: any | null;
  body: string | null;
  secrets: Secrets | null;
  requestContext: any;
}

export type ZambdaTriggerType = 'http_open' | 'http_auth' | 'subscription' | 'cron';

export interface ValuePair {
  value: string;
  label: string;
}

export const AllStates: ValuePair[] = [
  { value: 'AL', label: 'AL' }, // Alabama
  { value: 'AK', label: 'AK' }, // Alaska
  { value: 'AZ', label: 'AZ' }, // Arizona
  { value: 'AR', label: 'AR' }, // Arkansas
  { value: 'CA', label: 'CA' }, // California
  { value: 'CO', label: 'CO' }, // Colorado
  { value: 'CT', label: 'CT' }, // Connecticut
  { value: 'DE', label: 'DE' }, // Delaware
  { value: 'DC', label: 'DC' },
  { value: 'FL', label: 'FL' }, // Florida
  { value: 'GA', label: 'GA' }, // Georgia
  { value: 'HI', label: 'HI' }, // Hawaii
  { value: 'ID', label: 'ID' }, // Idaho
  { value: 'IL', label: 'IL' }, // Illinois
  { value: 'IN', label: 'IN' }, // Indiana
  { value: 'IA', label: 'IA' }, // Iowa
  { value: 'KS', label: 'KS' }, // Kansas
  { value: 'KY', label: 'KY' }, // Kentucky
  { value: 'LA', label: 'LA' }, // Louisiana
  { value: 'ME', label: 'ME' }, // Maine
  { value: 'MD', label: 'MD' }, // Maryland
  { value: 'MA', label: 'MA' }, // Massachusetts
  { value: 'MI', label: 'MI' }, // Michigan
  { value: 'MN', label: 'MN' }, // Minnesota
  { value: 'MS', label: 'MS' }, // Mississippi
  { value: 'MO', label: 'MO' }, // Missouri
  { value: 'MT', label: 'MT' }, // Montana
  { value: 'NE', label: 'NE' }, // Nebraska
  { value: 'NV', label: 'NV' }, // Nevada
  { value: 'NH', label: 'NH' }, // New Hampshire
  { value: 'NJ', label: 'NJ' }, // New Jersey
  { value: 'NM', label: 'NM' }, // New Mexico
  { value: 'NY', label: 'NY' }, // New York
  { value: 'NC', label: 'NC' }, // North Carolina
  { value: 'ND', label: 'ND' }, // North Dakota
  { value: 'OH', label: 'OH' }, // Ohio
  { value: 'OK', label: 'OK' }, // Oklahoma
  { value: 'OR', label: 'OR' }, // Oregon
  { value: 'PA', label: 'PA' }, // Pennsylvania
  { value: 'RI', label: 'RI' }, // Rhode Island
  { value: 'SC', label: 'SC' }, // South Carolina
  { value: 'SD', label: 'SD' }, // South Dakota
  { value: 'TN', label: 'TN' }, // Tennessee
  { value: 'TX', label: 'TX' }, // Texas
  { value: 'UT', label: 'UT' }, // Utah
  { value: 'VT', label: 'VT' }, // Vermont
  { value: 'VA', label: 'VA' }, // Virginia
  { value: 'VI', label: 'VI' },
  { value: 'WA', label: 'WA' }, // Washington
  { value: 'WV', label: 'WV' }, // West Virginia
  { value: 'WI', label: 'WI' }, // Wisconsin
  { value: 'WY', label: 'WY' }, // Wyoming
];
