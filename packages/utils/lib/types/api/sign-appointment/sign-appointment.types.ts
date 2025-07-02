import { Secrets } from '../../../secrets';

export interface SignAppointmentInput {
  appointmentId: string;
  secrets: Secrets;
}

export interface SignAppointmentResponse {
  message: string;
}
