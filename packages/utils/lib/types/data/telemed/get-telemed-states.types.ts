export interface TelemedLocation {
  state: string;
  name: string;
  slug: string;
  availableSlots: string[];
  available: boolean;
}

export interface GetTelemedLocationsResponse {
  locations: TelemedLocation[];
}
