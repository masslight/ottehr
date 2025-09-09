import { Secrets } from '../../../secrets';

export interface SignAppointmentInput {
  appointmentId: string;
  secrets: Secrets;
  timezone: string | null;
  supervisorApprovalEnabled?: boolean;
}

export interface SignAppointmentResponse {
  message: string;
}
