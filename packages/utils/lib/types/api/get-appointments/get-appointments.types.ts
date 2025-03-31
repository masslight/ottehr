export interface GetAppointmentsParameters {
  searchDate: string;
  locationID: string | undefined;
  visitType: string[];
  providerIDs?: string[];
  groupIDs?: string[];
}
