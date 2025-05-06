export interface TelemedLocation {
  state: string;
  available: boolean;
  scheduleId: string;
}

export interface GetTelemedLocationsResponse {
  locations: TelemedLocation[];
}
