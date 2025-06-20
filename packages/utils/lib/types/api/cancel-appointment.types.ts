import { CancellationReasonOptionsInPerson } from '..';

export interface CancelAppointmentZambdaInput {
  appointmentID: string;
  cancellationReason: CancellationReasonOptionsInPerson;
  silent?: boolean;
  language?: string;
}

export interface CancelAppointmentZambdaOutput {
  message: string;
  appointmentId: string;
  visitType: string;
}
