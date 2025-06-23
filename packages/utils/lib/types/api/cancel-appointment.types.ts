import { CancellationReasonOptionsInPerson } from '..';

export interface CancelAppointmentZambdaInput {
  appointmentID: string;
  cancellationReason: CancellationReasonOptionsInPerson;
  silent?: boolean;
  language?: string;
}

export type CancelAppointmentZambdaOutput = Record<string, never>;
