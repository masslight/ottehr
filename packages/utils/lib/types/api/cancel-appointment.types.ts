export interface CancelAppointmentZambdaInput {
  appointmentID: string;
  cancellationReason: string;
  silent?: boolean;
  language?: string;
  cancellationReasonAdditional?: string;
}

export type CancelAppointmentZambdaOutput = Record<string, never>;
