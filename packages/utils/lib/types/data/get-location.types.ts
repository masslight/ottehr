export interface GetScheduleResponse {
  message: string;
  state: string;
  name: string;
  slug: string;
  locationID?: string;
  providerID?: string;
  groupID?: string;
  availableSlots: string[];
  available: boolean;
  timezone: string;
}

export interface GetScheduleRequestParams {
  scheduleType?: string;
  slug?: string;
}
