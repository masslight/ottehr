export interface TelemedLocation {
  state: string;
  available: boolean;
}

export interface GetTelemedLocationsResponse {
  locations: TelemedLocation[];
}
