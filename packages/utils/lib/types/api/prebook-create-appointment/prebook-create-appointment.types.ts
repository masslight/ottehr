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
  /**
   * Location the slot is being offered at. Persisted via the slot-at-
   * location extension so create-appointment can read it directly. Omitted
   * for direct-Location bookings (where the Schedule.actor IS the Location
   * — recording it again would be pure duplication). Carried for groups
   * and PR-direct bookings where Schedule.actor doesn't uniquely identify
   * a Location.
   */
  atLocationId?: string;
  /**
   * Group HealthcareService id the slot is being booked through. Persisted
   * via the slot-booked-via-group extension so create-appointment (and
   * downstream capacity-guard / audit consumers) can identify the
   * originating group without re-parsing booking URLs. Carried only for
   * group bookings against non-HS-actored Schedules (the pools-providers
   * case); omitted when the Schedule.actor IS the group itself —
   * recording it again would be pure duplication.
   */
  bookedViaGroupId?: string;
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
  /**
   * The Location this slot is being booked at. Resolved via the same
   * precedence used by create-appointment (Location-actor → owner; single-
   * location PR-actor → PR.location[0]; otherwise the Slot's slot-at-
   * location extension). Populated whenever a Location can be resolved;
   * absent for slots that can't be attributed to a Location (e.g.,
   * Practitioner-actored without an extension). Distinct from
   * ownerName/ownerId, which describe the Schedule's actor.
   */
  bookingLocationId?: string;
  bookingLocationName?: string;
}
