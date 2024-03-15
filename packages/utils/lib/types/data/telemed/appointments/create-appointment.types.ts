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
}

export type PatientInfo = {
  id?: string;
  newPatient?: boolean;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: Patient['gender'];
  email?: string;
  emailUser?: UserType;
  reasonForVisit?: string[];
  phoneNumber?: string;
  pointOfDiscovery?: boolean;
};
