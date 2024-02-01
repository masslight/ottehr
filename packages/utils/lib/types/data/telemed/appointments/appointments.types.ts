export interface CancelAppointmentRequestParams {
  appointmentId: string;
  cancellationReason: string;
}

export interface UpdateAppointmentRequestParams {
  appointmentId: string;
  slot: string | undefined;
}
