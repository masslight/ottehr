import { Appointment, Encounter, Patient, QuestionnaireResponse, Slot } from 'fhir/r4b';
import { ServiceMode, Timezone } from '../../common';
import { PatientInfo } from '../../data';
import { ScheduleOwnerFhirResource } from '../schedules';

export interface CreateAppointmentInputParams {
  patient: PatientInfo;
  slotId: string;
  language?: string;
  unconfirmedDateOfBirth?: string | undefined;
}

export interface CreateAppointmentResponse {
  message: string;
  appointment: string | null;
  fhirPatientId: string;
  questionnaireResponseId: string | null;
  encounterId: string | null;
  relatedPersonId: string;
  resources: {
    appointment: Appointment;
    encounter: Encounter;
    questionnaire: QuestionnaireResponse;
    patient: Patient;
  };
}

export interface CreateSlotParams {
  scheduleId: string;
  startISO: string;
  serviceModality: ServiceMode;
  lengthInMinutes?: number;
  lengthInHours?: number;
  status?: Slot['status'];
  walkin?: boolean;
}

export interface GetSlotDetailsParams {
  slotId: string;
}

export interface GetSlotDetailsResponse {
  startISO: string;
  endISO: string;
  serviceMode: ServiceMode;
  ownerType: ScheduleOwnerFhirResource['resourceType'];
  ownerId: string;
  isWalkin: boolean;
  appointmentId?: string;
  comment?: string;
  timezoneForDisplay?: Timezone;
}
