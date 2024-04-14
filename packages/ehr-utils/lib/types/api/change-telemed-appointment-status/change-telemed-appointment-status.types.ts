import { Secrets } from 'ottehr-utils';
import { TelemedCallStatuses } from '../../appointment.types';

export interface ChangeTelemedAppointmentStatusInput {
  appointmentId: string;
  newStatus: TelemedCallStatuses;
  secrets: Secrets | null;
}

export interface ChangeTelemedAppointmentStatusResponse {
  message: string;
}
