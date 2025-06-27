/// <reference lib="dom" />
import {
  Address,
  ContactPoint,
  DocumentReference,
  Encounter,
  HealthcareService,
  Location,
  Practitioner,
  PractitionerRole,
  QuestionnaireResponse,
  Task,
} from 'fhir/r4b';
import { ScheduleExtension } from '../utils';
import { TIMEZONES } from './constants';

export interface PatientBaseInfo {
  firstName?: string;
  id?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
}
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
    imgBase64?: string;
  };
}
export interface AvailableLocationInformation {
  id: string | undefined;
  slug: string | undefined;
  name: string | undefined;
  description: string | undefined;
  address: Address | undefined;
  telecom: ContactPoint[] | undefined;
  timezone: Timezone | undefined;
  otherOffices: { display: string; url: string }[];
  scheduleOwnerType: ScheduleType;
  scheduleExtension?: ScheduleExtension;
}

// Closure start/end format: 'M/d/yyyy'
export interface Closure {
  start: string;
  end: string;
  type: ClosureType;
}
export enum ClosureType {
  OneDay = 'one-day',
  Period = 'period',
}

export const OVERRIDE_DATE_FORMAT = 'M/d/yyyy';
export const HOURS_OF_OPERATION_FORMAT = 'TT';

export const getSlugAndStateFromLocation = (
  location: AvailableLocationInformation | undefined
): { slug: string | undefined; state: string | undefined } => {
  if (location == undefined) {
    return { slug: undefined, state: undefined };
  }
  const { slug } = location;
  const state = location.address?.state?.toLowerCase();

  return { slug, state };
};

export type FormItemType =
  | 'Text'
  | 'Select'
  | 'Radio'
  | 'Radio List'
  | 'Free Select'
  | 'Date'
  | 'Year'
  | 'File'
  | 'Photos'
  | 'Checkbox'
  | 'Header 3'
  | 'Header 4'
  | 'Description'
  | 'Button'
  | 'Date Year'
  | 'Date Month'
  | 'Date Day'
  | 'Group'
  | 'Form list'
  | 'Attachment'
  | 'Credit Card'
  | 'Call Out'
  | undefined;

export type PromiseReturnType<T> = T extends Promise<infer R> ? R : never;

export interface ConsentInfo {
  HIPAA: boolean;
  consentToTreat: boolean;
  signature: string;
  fullName: string;
  relationship: string;
}
export interface ConsentSigner {
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

export const CREATED_BY_SYSTEM = 'created-by'; // exists in ehr as well

export enum PatientEthnicity {
  'Hispanic or Latino' = 'Hispanic or Latino',
  'Not Hispanic or Latino' = 'Not Hispanic or Latino',
  'Decline to Specify' = 'Decline to Specify',
}

export const PatientEthnicityCode: Record<keyof typeof PatientEthnicity, string | undefined> = {
  'Hispanic or Latino': '2135-2',
  'Not Hispanic or Latino': '2186-5',
  'Decline to Specify': 'ASKU',
};

export enum PatientRace {
  'American Indian or Alaska Native' = 'American Indian or Alaska Native',
  'Asian' = 'Asian',
  'Black or African American' = 'Black or African American',
  'Native Hawaiian or Other Pacific Islander' = 'Native Hawaiian or Other Pacific Islander',
  'White' = 'White',
  'Decline to Specify' = 'Decline to Specify',
}

export const PatientRaceCode: Record<keyof typeof PatientRace, string | undefined> = {
  'American Indian or Alaska Native': '1002-5',
  Asian: '2028-9',
  'Black or African American': '2054-5',
  'Native Hawaiian or Other Pacific Islander': '2076-8',
  White: '2106-3',
  'Decline to Specify': 'ASKU',
};

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
}

export interface SubscriptionZambdaDetails {
  criteria: string;
  reason: string;
  event?: 'create' | 'update';
}

export type ZambdaTriggerType = 'http_open' | 'http_auth' | 'subscription' | 'cron';

export interface ValuePair {
  value: string;
  label: string;
}

export const months = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

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

export type StateCode = (typeof AllStates)[number]['value'];

export const stateCodeToFullName: Readonly<Record<StateCode, string>> = {
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
  VA: 'Virginia',
  VI: 'Virgin Islands',
  VT: 'Vermont',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

export interface DateComponents {
  day: string;
  month: string;
  year: string;
}

export interface FacilityGroup {
  address: string;
  city: string;
  state: string;
  zip: string;
  tel: string;
  fax: string;
  group: string;
  npi: string;
  taxId: string;
}

export type StateType = (typeof AllStates extends readonly (infer TElementType)[] ? TElementType : never)['value'];

export interface VirtualLocationBody {
  name: string;
  code?: string;
}

export const AllStatesToVirtualLocationsData: {
  [value in StateType]: VirtualLocationBody;
} = {
  AL: { name: 'Telemed Alabama' },
  AK: {
    name: 'Telemed Alaska',
    code: 'AKTELE',
  },
  AZ: { name: 'Telemed Arizona' },
  AR: { name: 'Telemed Arkansas' },
  CA: {
    name: 'Telemed California',
    code: 'CATELE',
  },
  CO: { name: 'Telemed Colorado' },
  CT: {
    name: 'Telemed Connecticut',
    code: 'CTTELE',
  },
  DE: {
    name: 'Telemed Delaware',
    code: 'DETELE',
  },
  DC: { name: 'Telemed District of Columbia' },
  FL: {
    name: 'Telemed Florida',
    code: 'FLTELE',
  },
  GA: { name: 'Telemed Georgia' },
  HI: { name: 'Telemed Hawaii' },
  ID: { name: 'Telemed Idaho' },
  IL: {
    name: 'Telemed Illinois',
    code: 'ILTELE',
  },
  IN: { name: 'Telemed Indiana' },
  IA: { name: 'Telemed Iowa' },
  KS: { name: 'Telemed Kansas' },
  KY: { name: 'Telemed Kentucky' },
  LA: { name: 'Telemed Louisiana' },
  ME: { name: 'Telemed Maine' },
  MD: {
    name: 'Telemed Maryland',
    code: 'MDTELE',
  },
  MA: {
    name: 'Telemed Massachusetts',
    code: 'MATELE',
  },
  MI: { name: 'Telemed Michigan' },
  MN: { name: 'Telemed Minnesota' },
  MS: { name: 'Telemed Mississippi' },
  MO: { name: 'Telemed Missouri' },
  MT: { name: 'Telemed Montana' },
  NE: { name: 'Telemed Nebraska' },
  NV: { name: 'Telemed Nevada' },
  NH: { name: 'Telemed New Hampshire' },
  NJ: {
    name: 'Telemed New Jersey',
    code: 'NJTELE',
  },
  NM: { name: 'Telemed New Mexico' },
  NY: {
    name: 'Telemed New York',
    code: 'NYTELE',
  },
  NC: {
    name: 'Telemed North Carolina',
    code: 'NCTELE',
  },
  ND: { name: 'Telemed North Dakota' },
  OH: { name: 'Telemed Ohio' },
  OK: { name: 'Telemed Oklahoma' },
  OR: { name: 'Telemed Oregon' },
  PA: {
    name: 'Telemed Pennsylvania',
    code: 'PATELE',
  },
  RI: { name: 'Telemed Rhode Island' },
  SC: { name: 'Telemed South Carolina' },
  SD: { name: 'Telemed South Dakota' },
  TN: {
    name: 'Telemed Tennessee',
    code: 'TNTELE',
  },
  TX: {
    name: 'Telemed Texas',
    code: 'TXTELE',
  },
  UT: { name: 'Telemed Utah' },
  VT: { name: 'Telemed Vermont' },
  VI: { name: 'Telemed Virgin Islands' },
  VA: {
    name: 'Telemed Virginia',
    code: 'VATELE',
  },
  WA: { name: 'Telemed Washington' },
  WV: { name: 'Telemed West Virginia' },
  WI: { name: 'Telemed Wisconsin' },
  WY: { name: 'Telemed Wyoming' },
};

export enum FhirAppointmentType {
  walkin = 'walkin',
  posttelemed = 'posttelemed',
  prebook = 'prebook',
}

// internal communication coding
const INTERNAL_COMMUNICATION_SYSTEM = 'intra-communication';
const ISSUE_REPORT_CODE = 'intake-issue-report';

export const COMMUNICATION_ISSUE_REPORT_CODE = {
  system: INTERNAL_COMMUNICATION_SYSTEM,
  code: ISSUE_REPORT_CODE,
};

export interface FacilityInfo {
  name: string;
  address: string;
  phone: string;
}

export const FacilitiesTelemed: FacilityInfo[] = [
  { name: 'Telemed Alabama', address: 'Bayside, NY', phone: '' },
  { name: 'Telemed Alaska', address: 'Anchorage, AK', phone: '' },
  { name: 'Telemed Arizona', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed Arkansas', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed California', address: 'LOS ANGELES, CA', phone: '' },
  { name: 'Telemed Colorado', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed Connecticut', address: 'WEST HARTFORD, CT', phone: '' },
  { name: 'Telemed District of Columbia', address: 'GREENBELT, MD', phone: '' },
  { name: 'Telemed Delaware', address: 'NEWARK, DE', phone: '' },
  { name: 'Telemed Florida', address: 'CORAL SPRINGS, FL', phone: '' },
  { name: 'Telemed Georgia', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed Hawaii', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed Idaho', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed Illinois', address: 'Naperville, IL', phone: '' },
  { name: 'Telemed Indiana', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed Iowa', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed Maryland', address: 'GREENBELT, MD', phone: '' },
  { name: 'Telemed Massachusetts', address: 'DEDHAM, MA', phone: '' },
  { name: 'Telemed Michigan', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed Minnesota', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed Missouri', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed New Hampshire', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed New Jersey', address: 'LIVINGSTON, NJ', phone: '' },
  { name: 'Telemed New York', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed North Carolina', address: 'MORRISVILLE, NC', phone: '' },
  { name: 'Telemed Ohio', address: 'BAYSIDE, NY', phone: '' },
  { name: 'Telemed Pennsylvania', address: 'WAYNE, PA', phone: '' },
  { name: 'Telemed Tennessee', address: 'MURFREESBORO, TN', phone: '' },
  { name: 'Telemed Texas', address: 'THE COLONY, TX', phone: '' },
  { name: 'Telemed Virginia', address: 'SPRINGFIELD, VA', phone: '' },
];

export interface InHouseMedicationInfo {
  name: string;
  NDC: string;
  erxData: {
    id: string;
  };
}

export const InHouseMedications: InHouseMedicationInfo[] = [
  { name: 'Acetaminophen (Liquid)', NDC: '50580-170-01', erxData: { id: '23562' } },
  { name: 'Acetaminophen (Tabs)', NDC: '71399-8024-1', erxData: { id: '23170' } },
  { name: 'Acetaminophen (80mg Suppository)', NDC: '51672-2114-2', erxData: { id: '23565' } },
  { name: 'Acetaminophen (325mg Suppository)', NDC: '51672-2116-2', erxData: { id: '23564' } },
  { name: 'Acetaminophen (120mg Suppository)', NDC: '45802-732-30', erxData: { id: '21887' } },
  { name: 'Activated Charcoal', NDC: '66689-203-04', erxData: { id: '32034' } },
  { name: 'Albuterol', NDC: '0487-9501-25', erxData: { id: '29518' } },
  { name: 'Ventolin HFA', NDC: '0173-0682-24', erxData: { id: '38526' } },
  { name: 'Amoxicillin', NDC: '0143-9887-01', erxData: { id: '34220' } },
  { name: 'Amoxicillin Clavulanate', NDC: '65862-535-75', erxData: { id: '22329' } },
];

export type TaskStatus = 'completed' | 'failed' | 'rejected' | undefined;

export interface TaskSubscriptionInput {
  task: Task;
}

type Appointment_Update_Task_Codes = 'cancelled' | 'ready' | 'checkin' | 'record-wait-time';
type Appointment_Created_Task_Codes = 'create-appointment-confirmation-messages';

type Task_Codes = Appointment_Update_Task_Codes | Appointment_Created_Task_Codes;

export const Task_Email_Communication_Url = 'urgent-care-email';
export const Task_Text_Communication_Url = 'urgent-care-text';
export const Task_Update_Appointment_Url = 'urgent-care-update-appointment';
export const Task_Send_Messages_Url = 'urgent-care-send-messages';
export const Task_Sync_DocumentRef_Url = 'urgent-care-sync-document-ref';

type Task_System_Member =
  | typeof Task_Email_Communication_Url
  | typeof Task_Text_Communication_Url
  | typeof Task_Update_Appointment_Url
  | typeof Task_Send_Messages_Url
  | typeof Task_Sync_DocumentRef_Url;

export type TaskCoding = {
  readonly system: Task_System_Member;
  readonly code: Task_Codes;
};

const Task_Members = ['cancelEmail', 'readyText', 'checkInText', 'recordWaitTime', 'confirmationMessages'] as const;

type TaskMember = typeof Task_Members;
type TaskId = TaskMember[number];
type TaskIndicator = {
  [key in TaskId]: TaskCoding;
};

export const TaskIndicator: TaskIndicator = {
  cancelEmail: {
    system: Task_Email_Communication_Url,
    code: 'cancelled',
  },
  readyText: {
    system: Task_Text_Communication_Url,
    code: 'ready',
  },
  checkInText: {
    system: Task_Text_Communication_Url,
    code: 'checkin',
  },
  recordWaitTime: {
    system: Task_Update_Appointment_Url,
    code: 'record-wait-time',
  },
  confirmationMessages: {
    system: Task_Send_Messages_Url,
    code: 'create-appointment-confirmation-messages',
  },
};

export enum ServiceMode {
  'in-person' = 'in-person',
  'virtual' = 'virtual',
}

export enum ScheduleType {
  'location' = 'location',
  'group' = 'group',
  'provider' = 'provider',
}

export type BookableResource = Location | Practitioner | PractitionerRole | HealthcareService;

export interface BookableItem {
  slug: string;
  label: string;
  secondaryLabel: string[];
  resourceType: 'Location' | 'Practitioner' | 'PractitionerRole' | 'HealthcareService';
  resourceId: string;
  serviceMode?: ServiceMode;
  timezone?: string;
  category?: string;
  state?: string; // only adding this to preserve some current telemed behavior but it is likely unnecessary long term
}

export interface GetBookableItemListParams {
  serviceMode: string;
}
export interface BookableItemListResponse {
  items: BookableItem[];
  categorized: boolean;
}

export interface RelatedPersonParams {
  id?: string;
  patientId: string;
  phoneNumber?: string;
  relationshipCode?: string;
  relationshipSystem?: string;
}

export interface EncounterParams {
  startTime: string;
  patientId: string;
  locationId?: string;
  appointmentId?: string;
  status?: Encounter['status'];
  encounterClass?: {
    system: string;
    code: string;
    display: string;
  };
}

export interface UpdateQuestionnaireResponseParams {
  patientId: string;
  questionnaire?: string; // only for update
  questionnaireResponseId?: string; // only for update
  encounterId: string;
  status?: QuestionnaireResponse['status'];
  firstName?: string;
  lastName?: string;
  birthDate?: {
    day?: string;
    month?: string;
    year?: string;
  };
  fillingOutAs?: string;
  guardianEmail?: string;
  guardianNumber?: string;
  mobileOptIn?: boolean;
  ovrpInterest?: string;
  consentJurisdiction?: string;
  birthSex?: string;
  address?: {
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  email?: string;
  phoneNumber?: string;
  willBe18?: boolean;
  isNewPatient?: boolean;
  ethnicity?: string;
  race?: string;
  pronouns?: string;
  preferredLanguage?: string;
  relayPhone?: string;
  pcpInfo?: {
    firstName?: string;
    lastName?: string;
    practice?: string;
    address?: string;
    phoneNumber?: string;
  };
  paymentOption?: string;
  responsibleParty?: {
    relationship?: string;
    firstName?: string;
    lastName?: string;
    birthDate?: {
      day?: string;
      month?: string;
      year?: string;
    };
    birthSex?: string;
    phoneNumber?: string;
  };
  hipaaAcknowledgement?: boolean;
  consentToTreat?: boolean;
  signature?: string;
  fullName?: string;
  consentFormSignerRelationship?: string;
  consentFormSignerBirthDate?: string;
  consentFormSignerBirthSex?: string;
  consentFormSignerPhoneNumber?: string;
}

export interface DocumentReferenceParams {
  status?: DocumentReference['status'];
  date?: string;
  patientId: string;
  appointmentId: string;
  frontUrl?: string;
  backUrl?: string;
  frontContentType?: string;
  backContentType?: string;
  tagCode?: string;
  type?: {
    system?: string;
    code?: string;
    display?: string;
    text?: string;
  };
}

export interface CanonicalUrl {
  url: string;
  version: string;
}

export type Timezone = (typeof TIMEZONES)[number];
export interface GetVisitLabelInput {
  encounterId: string;
}
