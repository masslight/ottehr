import { Secrets } from '../../../secrets';

export interface SignAppointmentInput {
  appointmentId: string;
  timezone: string | null;
  secrets: Secrets | null;
}

export interface SignAppointmentResponse {
  message: string;
}
