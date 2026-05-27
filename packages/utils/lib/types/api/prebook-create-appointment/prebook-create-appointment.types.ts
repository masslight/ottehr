import { Appointment, Encounter, Patient, QuestionnaireResponse, Slot } from 'fhir/r4b';
import { ServiceCategoryCode } from '../../../ottehr-config';
import { AppointmentPaperworkSubtype, CanonicalUrl, ServiceMode, Timezone } from '../../common';
import { PatientInfo } from '../../data';
import { ScheduleOwnerFhirResource } from '../schedules';

export interface CreateAppointmentInputParams {
  patient: PatientInfo;
  slotId: string;
  language?: string;
  locationState?: string;
  appointmentMetadata?: Appointment['meta'];
  parentEncounterId?: string;
  // Optional override that picks an alternate paperwork flow for this appointment.
  // When set to 'consent-form-only', create-appointment scaffolds the encounter's
  // QuestionnaireResponse against LITE_INTAKE_PAPERWORK_CANONICAL instead of the
  // ServiceMode-based default. Also written to Appointment.appointmentType.coding
  // so the EHR can surface a paperwork-type badge without re-reading the QR.
  paperworkSubtype?: AppointmentPaperworkSubtype;
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
