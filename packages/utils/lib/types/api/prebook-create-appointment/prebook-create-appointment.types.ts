import { Appointment, CodeableConcept, Encounter, Patient, QuestionnaireResponse, Slot } from 'fhir/r4b';
import { ScheduleType, ServiceMode, Timezone } from '../../common';
import { PatientInfo, VisitType } from '../../data';
import { PUBLIC_EXTENSION_BASE_URL } from '../../../fhir';
import { ScheduleOwnerFhirResource } from '../schedules';

export interface CreateAppointmentInputParams {
  patient: PatientInfo;
  scheduleType: ScheduleType;
  serviceType: ServiceMode;
  locationID?: string;
  providerID?: string;
  groupID?: string;
  slot?: Slot;
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
  lengthInMinutes?: number;
  lengthInHours?: number;
  status?: Slot['status'];
  walkin?: boolean;
  serviceModality?: ServiceMode;
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
