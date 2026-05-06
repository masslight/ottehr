import { VisitStatusLabel } from '../../../api';
import { FileURLInfo, FileURLs } from '../../../common';
import { AnswerOptionSource } from '../../paperwork';
import { PatientInfo } from './create-appointment.types';
export interface CancelAppointmentRequestParams {
  appointmentID: string;
  cancellationReason: string;
  cancellationReasonAdditional?: string;
}

export interface UpdateAppointmentRequestParams {
  appointmentId: string;
  patient: PatientInfo;
  unconfirmedDateOfBirth?: string;
  locationState?: string;
}

export interface UpdateAppointmentResponse {
  appointmentId: string;
}

export interface GetTelemedAppointmentsRequest {
  patientId?: string;
}

export interface GetTelemedAppointmentsResponse {
  appointments: TelemedAppointmentInformationIntake[];
}

export interface GetVisitDetailsRequest {
  appointmentId: string;
}

export interface GetAnswerOptionsRequest {
  answerSource?: AnswerOptionSource;
  valueSet?: string;
}

export type GetPatientInsuranceOptionsRequest = object;

export type GetAllInsuranceOptionsRequest = object;

export interface PrescribedMedication {
  resourceId?: string;
  name?: string;
  instructions?: string;
}

export interface FollowUpDetails {
  encounterTime: string | undefined;
  documents: FileURLs;
}

export interface GetVisitDetailsResponse {
  files: FileURLs;
  medications: PrescribedMedication[];
  appointmentTime: string;
  followUps: FollowUpDetails[];
  reviewedLabResults: FileURLInfo[]; // external labs are "reviewed" after a practitioner clicks "Mark as Reviewed" and inhouse labs are "reviewed" at result entry
}

export interface PaymentDataResponse {
  chargeUuid: string;
  amount: number;
  currency: string;
  date: string;
  card: {
    id: string;
    brand: string;
    lastFour: string;
    expirationMonth: number;
    expirationYear: number;
  };
}

export interface TelemedAppointmentInformationIntake {
  id: string;
  start?: string;
  patient: {
    id?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  };
  appointmentStatus: string;
  status: VisitStatusLabel;
  state?: { code?: string; id?: string };
}
