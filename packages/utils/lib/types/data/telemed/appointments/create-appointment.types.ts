import { Patient } from 'fhir/r4';
import { UserType, PatientBaseInfo } from '../../../common';

export interface CreateAppointmentUCTelemedParams {
  patient?: PatientInfo;
  locationState?: string;
  timezone: string;
  unconfirmedDateOfBirth?: string | undefined;
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

export type PatientInfo = PatientBaseInfo & {
  newPatient?: boolean;
  sex?: Patient['gender'];
  email?: string;
  emailUser?: UserType;
  reasonForVisit?: string[];
  phoneNumber?: string;
  pointOfDiscovery?: boolean;
};
