import { Patient } from 'fhir/r4';
import { UserType } from '../../../common';

export interface CreateAppointmentUCTelemedParams {
  patient?: PatientInfo;
  locationState?: string;
}

export interface CreateAppointmentUCTelemedResponse {
  message: string;
  appointmentId: string;
  fhirPatientId: string;
}

export enum VisitType {
  WalkIn = 'walkin',
  PreBook = 'prebook',
  Reschedule = 'reschedule',
  Virtual = 'virtual',
}

export type PatientInfo = {
  id?: string;
  newPatient?: boolean;
  pointOfDiscovery: boolean; // if this info has been obtained, true & 'How did you hear about us' will not show
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: Patient['gender'];
  email?: string;
  emailUser: UserType;
  reasonForVisit?: string[];
  phoneNumber?: string;
};
