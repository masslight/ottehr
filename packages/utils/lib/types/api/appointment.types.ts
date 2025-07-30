import { Appointment, Encounter, Period, Slot } from 'fhir/r4b';
import { AvailableLocationInformation, ServiceMode, TelemedAppointmentStatusEnum } from '../../types';
import { SlotListItem } from '../../utils';

export type AppointmentType = 'walk-in' | 'pre-booked' | 'post-telemed';

export type ReviewAndSignData = {
  signedOnDate?: string;
};

export type RefreshableAppointmentData = {
  patientConditionPhotoUrls: string[];
};

export const mapStatusToTelemed = (
  encounterStatus: string,
  appointmentStatus: string | undefined
): TelemedAppointmentStatusEnum | undefined => {
  switch (encounterStatus) {
    case 'planned':
      return TelemedAppointmentStatusEnum.ready;
    case 'arrived':
      return TelemedAppointmentStatusEnum['pre-video'];
    case 'in-progress':
      return TelemedAppointmentStatusEnum['on-video'];
    case 'finished':
      if (appointmentStatus === 'fulfilled') return TelemedAppointmentStatusEnum.complete;
      else return TelemedAppointmentStatusEnum.unsigned;
    case 'cancelled':
      return TelemedAppointmentStatusEnum.cancelled;
  }
  return undefined;
};

export type FhirEncounterStatus = Encounter['status'];
export type FhirAppointmentStatus = Appointment['status'];

export const Visit_Status_Array = [
  'pending',
  'arrived',
  'ready',
  'intake',
  'ready for provider',
  'provider',
  'discharged',
  'cancelled',
  'no show',
  'completed',
  'unknown',
] as const;
export type VISIT_STATUS_TYPE = typeof Visit_Status_Array;
export type VisitStatusLabel = VISIT_STATUS_TYPE[number];
export type VisitStatusWithoutUnknown = Exclude<VisitStatusLabel, 'unknown'>;
export type VisitStatusHistoryLabel = Exclude<VisitStatusWithoutUnknown, 'ready'>;

export const visitStatusToFhirAppointmentStatusMap: Record<VisitStatusWithoutUnknown, FhirAppointmentStatus> = {
  pending: 'booked',
  arrived: 'arrived',
  ready: 'checked-in',
  intake: 'checked-in',
  'ready for provider': 'fulfilled',
  provider: 'fulfilled',
  discharged: 'fulfilled',
  cancelled: 'cancelled',
  'no show': 'noshow',
  completed: 'fulfilled',
};

export const visitStatusToFhirEncounterStatusMap: Record<VisitStatusWithoutUnknown, FhirEncounterStatus> = {
  pending: 'planned',
  arrived: 'arrived',
  ready: 'arrived',
  intake: 'in-progress',
  'ready for provider': 'in-progress',
  provider: 'in-progress',
  discharged: 'in-progress',
  cancelled: 'cancelled',
  'no show': 'cancelled',
  completed: 'finished',
};

export interface VisitStatusHistoryEntry {
  status: VisitStatusHistoryLabel;
  period: Period;
}

export interface GetAppointmentResponseAppointmentDetails {
  start: string;
  slot: Slot;
  location: AvailableLocationInformation;
  visitType: string;
  status?: string;
}

export interface GetAppointmentDetailsResponse {
  appointment: GetAppointmentResponseAppointmentDetails;
  availableSlots: SlotListItem[];
  displayTomorrowSlotsAtHour: number;
}

export interface UpdateAppointmentParameters {
  appointmentID: string;
  language: string;
  slot: Slot;
}

export interface UpdateAppointmentZambdaOutput {
  message: string;
  appointmentID?: string;
  availableSlots?: SlotListItem[];
}

export interface WalkinAvailabilityCheckParams {
  scheduleId?: string;
  locationName?: string;
}

export interface WalkinAvailabilityCheckResult {
  officeOpen: boolean;
  walkinOpen: boolean;
  officeHasClosureOverrideToday: boolean;
  officeHasClosureOverrideTomorrow: boolean;
  prebookStillOpenForToday: boolean;
  scheduleOwnerName: string;
  scheduleId: string;
  serviceMode?: ServiceMode;
}
export interface PatientAppointmentDTO {
  id: string;
  patientID: string;
  firstName: string;
  middleName: string;
  lastName: string;
  start: string;
  status: string;
  location?: { name: string; id: string; slug: string; state: string; timezone: string };
  paperworkComplete: boolean;
  checkedIn: boolean;
  visitType: string;
  visitStatus: VisitStatusLabel;
  slotId?: string;
}
