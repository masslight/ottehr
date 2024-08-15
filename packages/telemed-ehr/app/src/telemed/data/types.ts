export type GetZapEHRTelemedAPIParams = {
  isAppLocal?: 'true' | 'false';
  getTelemedAppointmentsZambdaID?: string;
  initTelemedSessionZambdaID?: string;
  getChartDataZambdaID?: string;
  saveChartDataZambdaID?: string;
  deleteChartDataZambdaID?: string;
  changeTelemedAppointmentStatusZambdaID?: string;
  getPatientInstructionsZambdaID?: string;
  savePatientInstructionZambdaID?: string;
  deletePatientInstructionZambdaID?: string;
  icdSearchZambdaId?: string;
  createSampleAppointmentsZambdaId?: string;
};

export interface ApiError {
  message: string;
}

export type PromiseReturnType<T> = T extends Promise<infer R> ? R : never;
