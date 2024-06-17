export interface GetLocationResponse {
  message: string;
  state: string;
  name: string;
  slug: string;
  availableSlots: string[];
  available: boolean;
}

export interface GetLocationRequestParams {
  slug?: string;
}
