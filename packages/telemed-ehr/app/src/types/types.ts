import { User } from '@zapehr/sdk';
import { Period } from 'fhir/r4';
import { DateTime } from 'luxon';
import { OtherEHRVisitStatus } from '../helpers/mappingUtils';
import { PractitionerLicense } from 'ehr-utils';

export interface GetAppointmentsParameters {
  searchDate?: DateTime | undefined;
  locationId: string | undefined;
}

export interface CreateAppointmentParameters {
  slot?: string | undefined;
  patient: PatientInfo | undefined;
  location?: string | undefined;
  visitType: VisitType | undefined;
}

export interface UpdateAppointmentAndEncounterParameters {
  appointmentId: string | null;
  appointmentStatus: string | null;
  encounterStatus: string | null;
}

export interface GetPatientParameters {
  patientId: string | undefined;
}

export interface UpdateUserParameters {
  userId: string | undefined;
  selectedRole?: RoleType | undefined;
  licenses?: PractitionerLicense[];
  // locations: Location[];
}

export interface DeactivateUserParameters {
  user: User | undefined;
  // locations: Location[];
}

export const enum RoleType {
  NewUser = 'NewUser',
  Manager = 'Manager',
  FrontDesk = 'FrontDesk',
  Staff = 'Staff',
  Provider = 'Provider',
  Administrator = 'Administrator',
}

export enum CancellationReasonOptions {
  'Patient improved' = 'Patient improved',
  'Wait time too long' = 'Wait time too long',
  'Prefer another urgent care provider' = 'Prefer another urgent care provider',
  'Changing location' = 'Changing location',
  'Changing to telemedicine' = 'Changing to telemedicine',
  'Financial responsibility concern' = 'Financial responsibility concern',
  'Insurance issue' = 'Insurance issue',
  'Service not offered at' = 'Service not offered at',
  'Duplicate visit or account error' = 'Duplicate visit or account error',
}

export const CancellationReasonCodes = {
  'Patient improved': 'patient-improved',
  'Wait time too long': 'wait-time',
  'Prefer another urgent care provider': 'prefer-another-provider',
  'Changing location': 'changing-location',
  'Changing to telemedicine': 'changing-telemedicine',
  'Financial responsibility concern': 'financial-concern',
  'Insurance issue': 'insurance-issue',
  'Service not offered at': 'service-not-offered',
  'Duplicate visit or account error': 'duplicate-visit-or-account-error',
};

export interface TwilioConversationModel {
  conversationSID: string;
  encounterId: string;
  relatedPersonParticipants: string[];
  clientPairing: number;
}

export interface VisitStatusHistoryEntry {
  status: OtherEHRVisitStatus;
  label: OtherEHRVisitStatus;
  period: Period;
}
export interface AppointmentInformation {
  id: string;
  start: string;
  // unreadMessage: boolean;
  conversationModel?: TwilioConversationModel;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  };
  reasonForVisit: string;
  comment: string | undefined;
  personID: string;
  appointmentType: string;
  appointmentStatus: string;
  status: OtherEHRVisitStatus;
  cancellationReason: string | undefined;
  paperwork: {
    demographics: boolean;
    photoID: boolean;
    insuranceCard: boolean;
    consent: boolean;
  };
  next: boolean;
  visitStatusHistory: VisitStatusHistoryEntry[];
  unconfirmedDateOfBirth: boolean | undefined;
}

export type PatientInfo = {
  id: string | undefined;
  newPatient: boolean;
  firstName: string | undefined;
  lastName: string | undefined;
  dateOfBirth: string | undefined;
  sex: PersonSex | undefined;
  phoneNumber: string | undefined;
  email: string | undefined;
  emailUser: 'Patient' | 'Parent/Guardian' | undefined;
  reasonForVisit: string[] | undefined;
};

export enum VisitType {
  WalkIn = 'walkin',
  PreBook = 'prebook',
}

export enum PersonSex {
  Male = 'male',
  Female = 'female',
  Intersex = 'other',
}

export interface State {
  label: string;
  value: string;
}

export const AllStates = [
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
] as const;

export type StateType = (typeof AllStates extends readonly (infer TElementType)[] ? TElementType : never)['value'];

export const AllStatesToNames: {
  [value in StateType]: string;
} = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VI: 'Virgin Islands',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

export const VisitTypeLabel = {
  walkin: 'Walk-in Urgent Care Visit (1UrgCare)',
  prebook: 'Pre-booked Urgent Care Visit (4Online)',
};
