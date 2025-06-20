export interface GetAppointmentsZambdaInput {
  searchDate: string;
  locationID?: string;
  providerIDs?: string[];
  groupIDs?: string[];
  visitType: string[];
}
