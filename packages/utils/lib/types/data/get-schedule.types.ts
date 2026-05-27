import { ServiceCategoryCode } from '../../ottehr-config';
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
  selectedDate?: string;
  serviceCategoryCode?: ServiceCategoryCode;
  /**
   * Slug of the Location at which slots are being requested. Required when
   * the schedule owner (or, for groups, its pool) spans multiple Locations.
   * Vended Slots carry this as the slot-at-location extension so booking
   * downstream is self-describing.
   */
  atLocationSlug?: string;
}
