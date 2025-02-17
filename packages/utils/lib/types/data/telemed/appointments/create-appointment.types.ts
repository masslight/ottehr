import { Address, Appointment, Encounter, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { PatientBaseInfo } from '../../../common';

export interface CreateAppointmentUCTelemedParams {
  patient?: PatientInfo;
  locationState?: string;
  timezone: string;
  unconfirmedDateOfBirth?: string;
}

export interface CreateAppointmentUCTelemedResponse {
  message: string;
  appointmentId: string;
  patientId: string;
  encounterId: string;
  questionnaireId: string;
  relatedPersonId: string;
  resources: {
    appointment: Appointment;
    encounter: Encounter;
    questionnaire: QuestionnaireResponse;
    patient: Patient;
  };
}

export enum VisitType {
  WalkIn = 'walkin',
  PreBook = 'prebook',
  Reschedule = 'reschedule',
  PostTelemed = 'posttelemed',
  Virtual = 'virtual',
}

export type PatientInfo = PatientBaseInfo & {
  newPatient?: boolean;
  chosenName?: string;
  sex?: Patient['gender'];
  weight?: number;
  weightLastUpdated?: string;
  email?: string;
  reasonForVisit?: string;
  reasonAdditional?: string;
  phoneNumber?: string;
  pointOfDiscovery?: boolean;
  telecom?: {
    system: string;
    value: string;
  }[];
  address?: Address[];
};

export interface PatientInfoInProgress extends Omit<PatientInfo, 'patientDateOfBirth'> {
  dobYear: string | undefined;
  dobMonth: string | undefined;
  dobDay: string | undefined;
}
