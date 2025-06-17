import { TelemedCallStatuses } from 'utils';
import { Secrets } from '../../../secrets';

export interface ChangeTelemedAppointmentStatusInput {
  appointmentId: string;
  newStatus: TelemedCallStatuses;
  secrets: Secrets | null;
}

export interface ChangeTelemedAppointmentStatusResponse {
  message: string;
}
