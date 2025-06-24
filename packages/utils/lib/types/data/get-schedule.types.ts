import { SlotListItem } from '../../utils';
import { AvailableLocationInformation, ScheduleType, Timezone } from '../common';

export interface GetScheduleResponse {
  message: string;
  available: SlotListItem[];
  waitingMinutes: number; // why does this exist?
  location?: AvailableLocationInformation;
  telemedAvailable: SlotListItem[];
  displayTomorrowSlotsAtHour: number;
  timezone?: Timezone;
}

export interface GetScheduleRequestParams {
  scheduleType: ScheduleType;
  slug: string;
  originalBookingUrl?: string;
  // specificSlot?: string;
}
