import { Patient } from 'fhir/r4';
import { UserType, PatientBaseInfo } from '../../../common';

export interface CreateAppointmentUCTelemedParams {
  patient?: PatientInfo;
  locationState?: string;
  slot?: string;
  visitType?: string;
  visitService?: string;
  timezone: string;
  unconfirmedDateOfBirth?: string | undefined;
}

export interface CreateAppointmentUCTelemedResponse {
  message: string;
  appointmentId: string;
  fhirPatientId: string;
}

export enum VisitType {
  Now = 'now',
  Prebook = 'prebook',
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
