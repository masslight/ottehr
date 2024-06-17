import { Patient } from 'fhir/r4';
import { UserType, PatientBaseInfo } from '../../../common';

export interface CreateAppointmentUCTelemedParams {
  patient?: PatientInfo;
  slot?: string;
  scheduleType?: "location" | "provider";
  visitType?: "prebook" | "now";
  visitService?: "in-person" | "telemedicine";
  locationID?: string;
  providerID?: string;
  groupID?: string;
  unconfirmedDateOfBirth?: string | undefined;
  timezone: string;
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
