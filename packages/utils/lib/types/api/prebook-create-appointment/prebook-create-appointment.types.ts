import { Appointment, Encounter, Patient, QuestionnaireResponse, Slot } from 'fhir/r4b';
import { ServiceCategoryCode } from '../../../ottehr-config';
import { CanonicalUrl, ServiceMode, Timezone } from '../../common';
import { PatientInfo } from '../../data';
import { ScheduleOwnerFhirResource } from '../schedules';

export interface CreateAppointmentInputParams {
  patient: PatientInfo;
  slotId: string;
  language?: string;
  locationState?: string;
  appointmentMetadata?: Appointment['meta'];
  parentEncounterId?: string;
  /**
   * When booking against a group (HealthcareService) schedule, optionally
   * scopes the booking to a specific Location that's a member of the group.
   * The resolved Location is stamped onto Encounter.location and added to
   * Appointment.participant so billing, tracking-board filtering, and other
   * location-dependent features behave as if the patient booked the Location
   * directly. Accepts the Location's slug.
   */
  atLocationSlug?: string;
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
  serviceCategoryCode?: ServiceCategoryCode;
  lengthInMinutes?: number;
  lengthInHours?: number;
  status?: Slot['status'];
  walkin?: boolean;
  postTelemedLabOnly?: boolean;
  originalBookingUrl?: string;
  /** Optional questionnaire canonical URL to use for appointments booked on this slot */
  questionnaireCanonical?: CanonicalUrl;
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
