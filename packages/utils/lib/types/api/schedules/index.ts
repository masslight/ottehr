import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { Closure, Timezone } from '../../../main';
import { DailySchedule, ScheduleOverrides } from '../../../utils';

export interface UpdateScheduleParams {
  scheduleId: string;
  timezone?: string;
  slug?: string;
  schedule?: DailySchedule;
  scheduleOverrides?: ScheduleOverrides;
  active?: Schedule['active'];
  closures?: Closure[];
}

export interface TelecomUpdate {
  phone?: string | null;
  url?: string | null;
  fax?: string | null;
}

export interface CreateScheduleParams extends Omit<UpdateScheduleParams, 'schedule'> {
  ownerId: string;
  ownerType: ScheduleOwnerFhirResource['resourceType'];
  schedule: DailySchedule;
}

export type ScheduleOwnerFhirResource = Location | Practitioner | PractitionerRole | HealthcareService;

export interface ListScheduleOwnersParams {
  ownerType: ScheduleOwnerFhirResource['resourceType'];
}

export interface ScheduleOwnerListItem {
  resourceType: ScheduleOwnerFhirResource['resourceType'];
  id: string;
  /** Display name. For provider rows, the practitioner's full name. */
  name: string;
  address?: string;
  hours?: string;
  /** Populated only for Practitioner rows on the provider-schedules tab —
   *  each provider can have multiple PRs, so we aggregate across them. */
  providerSchedulesSummary?: {
    locationNames: string[];
    categoryLabels: string[];
    scheduleCount: number;
  };
  supportPhoneNumber?: string;
  /** Whether the owner is active. For Location rows: `status === 'active'`. */
  active?: boolean;
}

export interface ScheduleListItem {
  resourceType: Schedule['resourceType'];
  id: string;
  timezone: Timezone;
  upcomingScheduleChanges?: string;
  todayHoursISO?: {
    open: string;
    close: string;
  };
  /**
   * Owner-context for provider (PractitionerRole) child rows: the Location the
   * role is bound to, so the combined Schedules list can render a "Provider ·
   * Location" pair per schedule. Absent for Location-owned schedules (there the
   * owner IS the location).
   */
  locationId?: string;
  locationName?: string;
  /** Service categories this schedule offers (PR schedules). */
  categoryLabels?: string[];
  /**
   * Effective liveness of THIS schedule for booking: `Schedule.active` combined
   * with the owning PractitionerRole's `active` (a PR schedule needs both). For
   * Location/Group schedules this is just `Schedule.active`; the owner-level
   * status is carried separately on the owner.
   */
  active?: boolean;
}

export interface SchedulesAndOwnerListItem {
  owner: ScheduleOwnerListItem;
  schedules: ScheduleListItem[];
}
export interface ListScheduleOwnersResponse {
  list: SchedulesAndOwnerListItem[];
}

export interface GetScheduleByIdParams {
  scheduleId: string;
}
export interface GetScheduleByOwnerParams {
  ownerId: string;
  ownerType: ScheduleOwnerFhirResource['resourceType'];
}

export type GetScheduleParams = GetScheduleByIdParams | GetScheduleByOwnerParams;
