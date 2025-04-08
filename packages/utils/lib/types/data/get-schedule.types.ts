import { AvailableLocationInformation, ScheduleType } from '../common';
import { SlotListItem } from '../../utils';

export interface GetScheduleResponse {
  message: string;
  available: SlotListItem[];
  waitingMinutes: number; // why does this exist?
  location?: AvailableLocationInformation;
  telemedAvailable: SlotListItem[];
  displayTomorrowSlotsAtHour: number;
  walkinOpen: boolean;
  openTime: string | undefined;
}

export interface GetScheduleRequestParams {
  scheduleType: ScheduleType;
  slug: string;
  specificSlot?: string;
}
