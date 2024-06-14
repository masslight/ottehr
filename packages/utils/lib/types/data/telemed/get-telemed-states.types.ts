export interface TelemedLocation {
  state: string;
  slug: string;
  available: boolean;
}

export interface GetTelemedLocationsResponse {
  locations: TelemedLocation[];
}
