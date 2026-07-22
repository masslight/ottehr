import { ServiceCategoryCode } from '../../ottehr-config';
import { SlotListItem } from '../../utils';
import { AvailableLocationInformation, ScheduleType, ServiceMode, Timezone } from '../common';

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
   * The service mode the slots are being requested for (from the /prebook/:mode
   * booking path). When set, get-schedule prunes member schedules whose paired
   * Location can't fulfill this mode, so a group that offers a mode its member
   * Location doesn't support surfaces no slots on that mode's link. Optional for
   * back-compat: callers that omit it get the prior unfiltered behavior.
   */
  serviceMode?: ServiceMode;
  /**
   * Slug of the Location at which slots are being requested. Required when
   * the schedule owner (or, for groups, its pool) spans multiple Locations.
   * Vended Slots carry this as the slot-at-location extension so booking
   * downstream is self-describing.
   */
  atLocationSlug?: string;
}
