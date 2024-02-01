export interface ApiError {
  message: string;
}

export type GetZapEHRAPIParams = {
  isAppLocal?: 'true' | 'false';
  checkInZambdaID?: string;
  createAppointmentZambdaID?: string;
  cancelAppointmentZambdaID?: string;
  updateAppointmentZambdaID?: string;
  getPatientsZambdaID?: string;
  updatePaperworkZambdaID?: string;
  getLocationZambdaID?: string;
  getAppointmentsZambdaID?: string;
  getPaperworkZambdaID?: string;
  getWaitStatusZambdaID?: string;
  getPresignedFileURLZambdaID?: string;
};
