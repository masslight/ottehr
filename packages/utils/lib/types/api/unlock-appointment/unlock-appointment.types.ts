export interface UnlockAppointmentZambdaInputValidated {
  appointmentId: string;
  secrets: any;
  userToken: string;
}

export interface UnlockAppointmentZambdaOutput {
  message: string;
}
