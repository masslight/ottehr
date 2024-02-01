import { User } from '@zapehr/sdk';
import { Period } from 'fhir/r4';
import { DateTime } from 'luxon';
import { OtherEHRVisitStatus } from '../helpers/visitMappingUtils';

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
  pointOfDiscovery: boolean; // if this info has been obtained, true & 'How did you hear about us' will not show
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
  Reschedule = 'reschedule',
}

export enum PersonSex {
  Male = 'male',
  Female = 'female',
  Intersex = 'other',
}
