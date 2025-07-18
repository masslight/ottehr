import { Appointment, Slot } from 'fhir/r4b';
import { FhirAppointmentType, OTTEHR_MODULE, PatientFollowupDetails, ScheduleType, ServiceMode } from 'utils';

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

export { AllStates } from 'utils';
export type { State, StateType } from 'utils';

export type EmailUserValue = 'Patient (Self)' | 'Parent/Guardian';

export const appointmentTypeLabels: { [type in FhirAppointmentType]: string } = {
  prebook: 'Pre-booked',
  walkin: 'Walk-in',
  posttelemed: 'Post Telemed',
};

// this might be a bit redundant given the AppointmentType type. is "booked" still used somewhere?
export enum VisitType {
  WalkIn = 'walk-in',
  PreBook = 'pre-booked',
  PostTelemed = 'post-telemed',
}

export const VisitTypeToLabel: { [visitType in VisitType]: string } = {
  'walk-in': 'Walk-in In Person Visit',
  'pre-booked': 'Pre-booked In Person Visit',
  'post-telemed': 'Post Telemed Lab Only',
};

export const VisitTypeToLabelTelemed: { [visitType in VisitType]: string } = {
  'walk-in': 'On-demand Telemed',
  'pre-booked': 'Pre-booked Telemed',
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

export const fhirAppointmentTypeToVisitType: { [type in FhirAppointmentType]: VisitType } = {
  prebook: VisitType.PreBook,
  walkin: VisitType.WalkIn,
  posttelemed: VisitType.PostTelemed,
};

export const getVisitTypeLabelForAppointment = (appointment: Appointment): string => {
  const fhirAppointmentType = appointment?.appointmentType?.text as FhirAppointmentType;
  const isFhirAppointmentMetaTagTelemed = appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.TM);

  let visitTypeToLabelEnum = VisitTypeToLabel;
  if (isFhirAppointmentMetaTagTelemed) {
    visitTypeToLabelEnum = VisitTypeToLabelTelemed;
  }

  const visitType = fhirAppointmentTypeToVisitType[fhirAppointmentType];

  const label = visitTypeToLabelEnum[visitType];
  return label || '-';
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
  CttConsent = 'Consent to Treat, Guarantee of Payment & Card on File Agreement',
  CttConsentOld = 'Consent to Treat and Guarantee of Payment',
}
export interface DocumentInfo {
  type: DocumentType;
  z3Url: string;
  presignedUrl: string | undefined;
}
