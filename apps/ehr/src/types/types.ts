import { User } from '@oystehr/sdk';
import { Appointment, Coding, Practitioner, Encounter, Slot } from 'fhir/r4b';
import {
  PatientFollowupDetails,
  FhirAppointmentType,
  PractitionerLicense,
  VisitStatusWithoutUnknown,
  DiagnosisDTO,
  OrderableItemSearchResult,
  OTTEHR_MODULE,
} from 'utils';
import { ScheduleType, ServiceMode } from 'utils';

export interface GetAppointmentsParameters {
  searchDate?: string;
  locationID: string | undefined;
  visitType?: string[];
  providerIDs?: string[];
  groupIDs?: string[];
}

// this likely will be consolidated to utils package. doughty conflict resolver, take heed:
// the important change to include here is that slot is of type "Slot" rather than string
export interface CreateAppointmentParameters {
  patient: PatientInfo | undefined;
  visitType: FhirAppointmentType | undefined;
  scheduleType: ScheduleType;
  serviceType: ServiceMode;
  slot?: Slot | undefined;
  locationID?: string | undefined;
}

export interface SaveFollowupParameter {
  encounterDetails: PatientFollowupDetails;
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
  reasonForVisit: string | undefined;
  reasonAdditional?: string;
};

export interface UpdateUserParameters {
  userId: string | undefined;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  nameSuffix?: string;
  selectedRoles?: string[] | undefined;
  licenses?: PractitionerLicense[];
  phoneNumber?: string;
  npi?: string;
  // locations: Location[];
}

export interface AssignPractitionerParameters {
  encounterId: string | undefined;
  practitioner: Practitioner | undefined;
  userRole: Coding[];
}

export interface UnassignPractitionerParameters {
  encounterId: string | undefined;
  practitioner: Practitioner | undefined;
  userRole: Coding[];
}

export interface ChangeInPersonVisitStatusParameters {
  encounterId: string | undefined;
  user: User | undefined;
  updatedStatus: VisitStatusWithoutUnknown | undefined;
}

export { AllStates } from 'utils';
export type { State, StateType } from 'utils';

export interface DeactivateUserParameters {
  user: User | undefined;
  // locations: Location[];
}

export interface CancelAppointmentParameters {
  appointmentID: string;
  cancellationReason: CancellationReasonOptions;
}

export enum CancellationReasonOptions {
  'Patient improved' = 'Patient improved',
  'Wait time too long' = 'Wait time too long',
  'Prefer another provider' = 'Prefer another provider',
  'Changing location' = 'Changing location',
  'Changing to telemedicine' = 'Changing to telemedicine',
  'Financial responsibility concern' = 'Financial responsibility concern',
  'Insurance issue' = 'Insurance issue',
  'Service never offered' = 'Service never offered',
  'Duplicate visit or account error' = 'Duplicate visit or account error',
}

export type EmailUserValue = 'Patient (Self)' | 'Parent/Guardian';

export const appointmentTypeLabels: { [type in FhirAppointmentType]: string } = {
  prebook: 'Pre-booked',
  walkin: 'Walk-in',
  posttelemed: 'Post Telemed',
  virtual: 'Telemed',
};

// this might be a bit redundant given the AppointmentType type. is "booked" still used somewhere?
export enum VisitType {
  WalkIn = 'walk-in',
  PreBook = 'pre-booked',
  PostTelemed = 'post-telemed',
}

export const VisitTypeToLabel: { [visittype in VisitType]: string } = {
  'walk-in': 'Walk-in In Person Visit',
  'pre-booked': 'Pre-booked In Person Visit',
  'post-telemed': 'Post Telemed Lab Only',
};

export enum PersonSex {
  Male = 'male',
  Female = 'female',
  Intersex = 'other',
}

export const getFhirAppointmentTypeForVisitType = (
  visitType: VisitType | undefined
): FhirAppointmentType | undefined => {
  if (visitType === VisitType.WalkIn) {
    return FhirAppointmentType.walkin;
  } else if (visitType === VisitType.PostTelemed) {
    return FhirAppointmentType.posttelemed;
  } else if (visitType === VisitType.PreBook) {
    return FhirAppointmentType.prebook;
  } else {
    return undefined;
  }
};

export const getVisitTypeLabelForAppointment = (appointment: Appointment): string => {
  const fhirAppointmentType = appointment?.appointmentType?.text as FhirAppointmentType;
  const isFhirAppointmentMetaTagTelemed = appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.TM);

  if (fhirAppointmentType === FhirAppointmentType.walkin) {
    return 'Walk-in In Person Visit';
  } else if (fhirAppointmentType === FhirAppointmentType.posttelemed) {
    return 'Post Telemed Lab Only';
  } else if (fhirAppointmentType === FhirAppointmentType.prebook) {
    if (isFhirAppointmentMetaTagTelemed) return 'Pre-booked Telemed';
    return 'Pre-booked In Person Visit';
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

export enum DocumentType {
  InsuranceFront = 'insurance-card-front',
  InsuranceBack = 'insurance-card-back',
  FullInsurance = 'fullInsuranceCard',
  InsuranceFrontSecondary = 'insurance-card-front-2',
  InsuranceBackSecondary = 'insurance-card-back-2',
  FullInsuranceSecondary = 'fullInsuranceCard-2',
  PhotoIdFront = 'photo-id-front',
  PhotoIdBack = 'photo-id-back',
  FullPhotoId = 'fullPhotoIDCard',
  HipaaConsent = 'HIPAA Acknowledgement',
  CttConsent = 'Consent to Treat and Guarantee of Payment',
}
export interface DocumentInfo {
  type: DocumentType;
  z3Url: string;
  presignedUrl: string | undefined;
}

export interface SubmitLabOrderParameters {
  dx: DiagnosisDTO[];
  encounter: Encounter;
  practitionerId: string;
  orderableItem: OrderableItemSearchResult;
  pscHold: boolean;
}
