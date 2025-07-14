import { Secrets } from '../../../secrets';

export interface SignAppointmentInput {
  appointmentId: string;
  secrets: Secrets;
  timezone: string | null;
}

export interface SignAppointmentResponse {
  message: string;
}
