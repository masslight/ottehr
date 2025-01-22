import { Appointment, Encounter, Period } from 'fhir/r4b';
import { TelemedAppointmentStatusEnum } from '../../types';

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
  'ready for discharge',
  'cancelled',
  'no show',
  'completed',
  'unknown',
] as const;
export type VISIT_STATUS_TYPE = typeof Visit_Status_Array;
export type VisitStatusLabel = VISIT_STATUS_TYPE[number];
export type VisitStatusWithoutUnknown = Exclude<VisitStatusLabel[number], 'unknown'>;
export type VisitStatusHistoryLabel = Exclude<VisitStatusWithoutUnknown[number], 'ready'>;

export const visitStatusToFhirAppointmentStatusMap: Record<VisitStatusWithoutUnknown, FhirAppointmentStatus> = {
  pending: 'booked',
  arrived: 'arrived',
  ready: 'checked-in',
  intake: 'fulfilled',
  'ready for provider': 'fulfilled',
  provider: 'fulfilled',
  'ready for discharge': 'fulfilled',
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
  'ready for discharge': 'in-progress',
  cancelled: 'cancelled',
  'no show': 'cancelled',
  completed: 'finished',
};

export interface VisitStatusHistoryEntry {
  status: VisitStatusHistoryLabel;
  period: Period;
}
