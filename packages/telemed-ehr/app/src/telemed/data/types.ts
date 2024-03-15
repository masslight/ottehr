export type GetZapEHRTelemedAPIParams = {
  isAppLocal?: 'true' | 'false';
  getTelemedAppointmentsZambdaID?: string;
  getUserZambdaID?: string;
  initTelemedSessionZambdaID?: string;
  getChartDataZambdaID?: string;
  saveChartDataZambdaID?: string;
  deleteChartDataZambdaID?: string;
};

export interface ApiError {
  message: string;
}

export type PromiseReturnType<T> = T extends Promise<infer R> ? R : never;
