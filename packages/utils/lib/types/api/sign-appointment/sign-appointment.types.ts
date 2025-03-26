import { Secrets } from '../../../secrets';

export interface SignAppointmentInput {
  appointmentId: string;
  secrets: Secrets | null;
}

export interface SignAppointmentResponse {
  message: string;
}
