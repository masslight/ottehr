export interface ApiError {
  message: string;
}

export type GetOystehrAPIParams = {
  cancelAppointmentZambdaID?: string;
  checkInZambdaID?: string;
  createAppointmentZambdaID?: string;
  createPaperworkZambdaID?: string;
  deletePaymentMethodZambdaID?: string;
  getAppointmentsZambdaID?: string;
  getPastVisitsZambdaID?: string;
  getEligibilityZambdaID?: string;
  getVisitDetailsZambdaID?: string;
  getAnswerOptionsZambdaID?: string;
  getScheduleZambdaID?: string;
  getPaperworkZambdaID?: string;
  getPatientsZambdaID?: string;
  getPaymentMethodsZambdaID?: string;
  getPresignedFileURLZambdaID?: string;
  getTelemedLocationsZambdaID?: string;
  getWaitStatusZambdaID?: string;
  isAppLocal?: 'true' | 'false';
  joinCallZambdaID?: string;
  setDefaultPaymentMethodZambdaID?: string;
  setupPaymentMethodZambdaID?: string;
  updateAppointmentZambdaID?: string;
  patchPaperworkZambdaID?: string;
  submitPaperworkZambdaID?: string;
  videoChatCancelInviteZambdaID?: string;
  videoChatCreateInviteZambdaID?: string;
  videoChatListInvitesZambdaID?: string;
  listBookablesZambdaID?: string;
};
