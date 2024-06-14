export interface TelemedLocation {
  state: string;
  slug: string;
  availableSlots: string[];
  available: boolean;
}

export interface GetTelemedLocationsResponse {
  locations: TelemedLocation[];
}
