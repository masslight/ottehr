import { Address, HealthcareService, Location, Practitioner, Schedule } from 'fhir/r4b';
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
  isVirtual?: boolean;
  stripeAccountId?: string | null;
  advapacsLocationId?: string | null;
  rooms?: string[];
  name?: string;
  description?: string | null;
  address?: Address | null;
  telecom?: TelecomUpdate | null;
  reviewLink?: string | null;
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

export type ScheduleOwnerFhirResource = Location | Practitioner | HealthcareService;

export interface ListScheduleOwnersParams {
  ownerType: ScheduleOwnerFhirResource['resourceType'];
}

export interface ScheduleOwnerListItem {
  resourceType: ScheduleOwnerFhirResource['resourceType'];
  id: string;
  name: string;
  address?: string;
  hours?: string;
  supportPhoneNumber?: string;
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
