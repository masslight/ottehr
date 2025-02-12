import { Secrets } from 'zambda-utils';

export interface SignAppointmentInput {
  appointmentId: string;
  secrets: Secrets | null;
}

export interface SignAppointmentResponse {
  message: string;
}
