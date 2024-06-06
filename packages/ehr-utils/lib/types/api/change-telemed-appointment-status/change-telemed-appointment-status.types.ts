import { Secrets } from 'ehr-utils';
import { TelemedCallStatuses } from '../../appointment.types';

export interface ChangeTelemedAppointmentStatusInput {
  appointmentId: string;
  newStatus: TelemedCallStatuses;
  secrets: Secrets | null;
}

export interface ChangeTelemedAppointmentStatusResponse {
  message: string;
}
