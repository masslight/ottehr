import { Address } from 'fhir/r4';
import { AvailableLocationInformation } from '../api/zapehrApi';
import { FileURLs, PaperworkPage } from '../types/types';

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
  newPatient: boolean | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  dateOfBirth: string | undefined;
  sex: PersonSex | undefined;
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

export interface Location {
  id: string | undefined;
  name: string | undefined;
  address: Address | undefined;
  description: string | undefined;
}
export type IntakeAction =
  | { type: 'SET_VISIT_TYPE'; visitType: VisitType }
  | { type: 'UPDATE_SELECTED_LOCATION'; location: AvailableLocationInformation }
  | { type: 'UPDATE_PATIENTS'; patients: PatientInfo[] }
  | { type: 'UPDATE_PATIENT'; patient: PatientInfo | undefined }
  | { type: 'UPDATE_APPOINTMENT_SLOT'; appointmentSlot: string }
  | { type: 'UPDATE_APPOINTMENT_ID'; appointmentID: string }
  | { type: 'UPDATE_NETWORK_ERROR'; networkError: boolean }
  | { type: 'UPDATE_PAPERWORK_QUESTIONS'; paperworkQuestions: PaperworkPage[] }
  | { type: 'UPDATE_COMPLETED_PAPERWORK'; completedPaperwork: any[] }
  | { type: 'UPDATE_FILE_URLS'; fileURLs: FileURLs };

export type IntakeState = {
  patientInfo?: PatientInfo;
  visitType?: VisitType;
  selectedLocation?: AvailableLocationInformation;
  patients?: PatientInfo[];
  appointmentSlot?: string;
  appointmentID?: string;
  networkError?: boolean;
  paperworkQuestions?: PaperworkPage[];
  completedPaperwork?: any;
  fileURLs?: FileURLs;
  unconfirmedDateOfBirth?: string;
};
