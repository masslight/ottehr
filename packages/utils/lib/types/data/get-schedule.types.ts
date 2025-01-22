import { AvailableLocationInformation, ScheduleType } from '../common';

export interface GetScheduleResponse {
  message: string;
  location: AvailableLocationInformation;
  locationID?: string;
  providerID?: string;
  groupID?: string;
  available: string[];
  waitingMinutes: number;
  telemedAvailable: string[];
  displayTomorrowSlotsAtHour: number;
  walkinOpen: boolean;
  openTime: string | undefined;
}

export interface GetScheduleRequestParams {
  scheduleType: ScheduleType;
  slug: string;
  specificSlot?: string;
}
