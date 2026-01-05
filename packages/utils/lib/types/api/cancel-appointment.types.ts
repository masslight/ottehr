export interface CancelAppointmentZambdaInput {
  appointmentID: string;
  cancellationReason: string;
  silent?: boolean;
  language?: string;
}

export type CancelAppointmentZambdaOutput = Record<string, never>;
