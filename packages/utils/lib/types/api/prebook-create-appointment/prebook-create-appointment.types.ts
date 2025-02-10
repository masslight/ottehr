import { Appointment, Encounter, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { ScheduleType, ServiceMode } from '../../common';
import { PatientInfo, VisitType } from '../../data';

export interface CreateAppointmentInputParams {
  slot: string;
  patient: PatientInfo;
  scheduleType: ScheduleType;
  serviceType: ServiceMode;
  locationID?: string;
  providerID?: string;
  groupID?: string;
  visitType: VisitType;
  language: string;
  unconfirmedDateOfBirth?: string | undefined;
  bookingContext?: Record<string, string>; // real open-ended piece of data we can send for whatver quirky business logic needs doing
}

export interface CreateAppointmentResponse {
  message: string;
  appointment: string | null;
  fhirPatientId: string;
  questionnaireResponseId: string | null;
  encounterId: string | null;
  resources: {
    appointment: Appointment;
    encounter: Encounter;
    questionnaire: QuestionnaireResponse;
    patient: Patient;
  };
}
