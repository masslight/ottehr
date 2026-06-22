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
  /**
   * Populated when the requested owner (typically a group) operates at
   * multiple Locations and the caller didn't provide an atLocationSlug.
   * Slot lists are empty in this case; the front-end should render a
   * Location picker and re-call with `atLocationSlug` set to the chosen
   * Location's slug.
   */
  pickableLocations?: PickableLocation[];
}

export interface PickableLocation {
  id: string;
  slug: string;
  name: string;
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
