export interface UnlockAppointmentZambdaInputValidated {
  // Exactly one of these is provided: appointmentId for appointment-backed visits, encounterId for
  // annotation follow-ups (which have no own Appointment and carry the lock on the Encounter).
  appointmentId?: string;
  encounterId?: string;
  secrets: any;
  userToken: string;
}

export interface UnlockAppointmentZambdaOutput {
  message: string;
}
