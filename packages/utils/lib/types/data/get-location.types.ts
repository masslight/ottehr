export interface GetScheduleResponse {
  message: string;
  state: string;
  name: string;
  slug: string;
  locationID?: string;
  providerID?: string;
  availableSlots: string[];
  available: boolean;
}

export interface GetScheduleRequestParams {
  scheduleType?: string;
  slug?: string;
}
