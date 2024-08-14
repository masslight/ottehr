import { User } from '@zapehr/sdk';
import { Appointment, Period } from 'fhir/r4';
import { DateTime } from 'luxon';
import { ExamFieldsNames, PractitionerLicense, VisitStatus } from 'ehr-utils';

export interface GetAppointmentsParameters {
  searchDate?: DateTime | undefined;
  locationID: string | undefined;
  visitType?: string[];
  providerIDs?: string[];
  groupIDs?: string[];
}

export interface CreateAppointmentParameters {
  slot?: string | undefined;
  patient: PatientInfo | undefined;
  locationID?: string | undefined;
  visitType: VisitType | undefined;
  scheduleType: 'location' | 'provider' | 'group' | undefined;
  visitService: 'in-person' | 'telemedicine' | undefined;
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
  firstName?: string;
  middleName?: string;
  lastName?: string;
  nameSuffix?: string;
  selectedRoles?: string[] | undefined;
  licenses?: PractitionerLicense[];
  // locations: Location[];
}

export interface GetUserParameters {
  userId: string | undefined;
}

export interface License {
  label: string;
  value: string;
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

export interface DeactivateUserParameters {
  user: User | undefined;
  // locations: Location[];
}

export interface CancelAppointmentParameters {
  appointmentID: string;
  cancellationReason: CancellationReasonOptions;
}

export interface EmployeeDetails {
  id: string;
  profile: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: 'Active' | 'Deactivated';
  lastLogin?: string;
  licenses: PractitionerLicense[];
  seenPatientRecently: boolean;
  isProvider: boolean;
}

export interface GetEmployeesResponse {
  message: string;
  employees: EmployeeDetails[];
}

export enum RoleType {
  NewUser = 'NewUser',
  Administrator = 'Administrator',
  AssistantAdmin = 'AssistantAdmin',
  RegionalTelemedLead = 'RegionalTelemedLead',
  CallCentre = 'CallCentre',
  Billing = 'Billing',
  Manager = 'Manager',
  Staff = 'Staff',
  Provider = 'Provider',
  FrontDesk = 'Front Desk',
  Inactive = 'Inactive',
}

export interface AccessPolicy {
  rule: {
    action: string | string[];
    resource: string | string[];
    effect: 'Allow' | 'Deny';
  }[];
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

export interface SMSRecipient {
  relatedPersonId: string;
  smsNumber: string;
}
export interface SMSModel {
  recipients: SMSRecipient[];
  hasUnreadMessages: boolean;
}

export interface VisitStatusHistoryEntry {
  status: VisitStatus;
  label: VisitStatus;
  period: Period;
}

export type EmailUserValue = 'Patient (Self)' | 'Parent/Guardian';

export interface AppointmentInformation {
  id: string;
  start: string;
  // unreadMessage: boolean;
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
  status: VisitStatus;
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
  // pointOfDiscovery: boolean; // if this info has been obtained, true & 'How did you hear about us' will not show
  firstName: string | undefined;
  lastName: string | undefined;
  dateOfBirth: string | undefined;
  sex: PersonSex | undefined;
  phoneNumber: string | undefined;
  email: string | undefined;
  emailUser: EmailUserValue | undefined;
  reasonForVisit: string[] | undefined;
};

export const appointmentTypeLabels: { [type in FhirAppointmentType]: string } = {
  prebook: 'Pre-booked',
  walkin: 'Walk-in',
  virtual: 'Telemed',
};

export enum VisitType {
  Now = 'now',
  Prebook = 'prebook',
}

export const VisitTypeToLabel: { [visittype in VisitType]: string } = {
  now: 'now',
  prebook: 'prebook',
};

export enum PersonSex {
  Male = 'male',
  Female = 'female',
  Intersex = 'other',
}

export enum FhirAppointmentType {
  walkin = 'walkin',
  prebook = 'prebook',
  virtual = 'virtual',
}

export const getFhirAppointmentTypeForVisitType = (
  visitType: VisitType | undefined,
): FhirAppointmentType | undefined => {
  if (visitType === VisitType.Now) {
    return FhirAppointmentType.walkin;
  } else if (visitType === VisitType.Prebook) {
    return FhirAppointmentType.prebook;
  } else {
    return undefined;
  }
};

export const getVisitTypeLabelForAppointment = (appointment: Appointment): string => {
  const fhirAppointmentType = appointment?.appointmentType?.text as FhirAppointmentType;

  if (fhirAppointmentType === FhirAppointmentType.walkin) {
    return 'Now Urgent Care Visit';
  } else if (fhirAppointmentType === FhirAppointmentType.prebook) {
    return 'Pre-booked Urgent Care Visit (4Online)';
  } else if (fhirAppointmentType === FhirAppointmentType.virtual) {
    return 'Telemed';
  }
  return '-';
};

export type DOW = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type HourOfDay =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23;

export interface Capacity {
  hour: HourOfDay;
  capacity: number;
}

export interface ScheduleDay {
  open: HourOfDay;
  close: HourOfDay;
  openingBuffer: number;
  closingBuffer: number;
  workingDay: boolean;
  hours: Capacity[];
}
export interface Weekdays {
  [day: string]: Weekday;
}

export interface Overrides {
  [day: string]: Day;
}

export interface Day {
  open: number;
  close: number;
  openingBuffer: number;
  closingBuffer: number;
  hours: Capacity[];
}

export interface Weekday extends Day {
  workingDay: boolean;
}

export enum ClosureType {
  OneDay = 'one-day',
  Period = 'period',
}
export interface Closure {
  start: string;
  end: string;
  type: ClosureType;
}

export interface ScheduleExtension {
  schedule: DailySchedule | undefined;
  scheduleOverrides: ScheduleOverrides | undefined;
  closures: Closure[] | undefined;
}

export type DailySchedule = Record<DOW, ScheduleDay>;
export type ScheduleOverrides = Record<string, ScheduleDay>;

export interface lastModifiedCode {
  lastModifiedDate: DateTime;
  lastModifiedBy: string | undefined;
  lastModifiedByID: string | undefined;
}

export type ExamTabCardNames =
  | 'vitals'
  | 'general'
  | 'head'
  | 'eyes'
  | 'nose'
  | 'ears'
  | 'mouth'
  | 'neck'
  | 'chest'
  | 'back'
  | 'skin'
  | 'abdomen'
  | 'musculoskeletal'
  | 'neurological'
  | 'psych';

export type ExamTabProviderCardNames = Exclude<ExamTabCardNames, 'vitals'>;

export type ExamTabGroupNames =
  | 'normal'
  | 'abnormal'
  | 'rightEye'
  | 'leftEye'
  | 'rightEar'
  | 'leftEar'
  | 'form'
  | 'dropdown';

export type ExamObservationFieldItem = {
  field: ExamFieldsNames;
  defaultValue: boolean;
  abnormal: boolean;
  group: ExamTabGroupNames;
  card: ExamTabProviderCardNames;
  label: string;
};

export enum CardType {
  InsuranceFront = 'insurance-card-front',
  InsuranceBack = 'insurance-card-back',
  PhotoIdFront = 'photo-id-front',
  PhotoIdBack = 'photo-id-back',
}
export interface CardInfo {
  type: CardType;
  z3Url: string;
  presignedUrl: string | undefined;
}
