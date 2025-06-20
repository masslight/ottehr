import { Appointment, Encounter, Patient, QuestionnaireResponse, Slot } from 'fhir/r4b';
import { ServiceMode, Timezone } from '../../common';
import { PatientInfo } from '../../data';
import { ScheduleOwnerFhirResource } from '../schedules';

export interface CreateAppointmentInputParams {
  patient: PatientInfo;
  slotId: string;
  language?: string;
  locationState?: string;
  unconfirmedDateOfBirth?: string | undefined;
  appointmentMetadata?: Appointment['meta'];
}

export interface CreateAppointmentResponse {
  message: string;
  appointmentId: string;
  fhirPatientId: string;
  questionnaireResponseId: string;
  encounterId: string;
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
  postTelemedLabOnly?: boolean;
  originalBookingUrl?: string;
}

export interface GetSlotDetailsParams {
  slotId: string;
}

export interface GetSlotDetailsResponse {
  slotId: string;
  status: Slot['status'];
  scheduleId: string;
  startISO: string;
  endISO: string;
  serviceMode: ServiceMode;
  ownerType: ScheduleOwnerFhirResource['resourceType'];
  ownerId: string;
  ownerName: string;
  isWalkin: boolean;
  appointmentId?: string;
  comment?: string;
  timezoneForDisplay?: Timezone;
  originalBookingUrl?: string;
}
