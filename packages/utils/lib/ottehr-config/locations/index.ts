import _ from 'lodash';
import * as z from 'zod';
import { LOCATIONS_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';

const overrides: any = OVERRIDES || {};
const LOCATION_DEFAULTS: any = {
  inPersonLocations: ['New York', 'Los Angeles'],
  telemedLocations: ['Telemed New Jersey', 'Telemed Ohio'],
  supportPhoneNumber: '(202) 555-1212',
  supportScheduleGroups: [],
};

const mergedLocationConfig = _.merge(
  JSON.parse(JSON.stringify(LOCATION_DEFAULTS)),
  JSON.parse(JSON.stringify(overrides || {}))
);

const LocationConfigSchema = z.object({
  inPersonLocations: z.array(z.string().min(1)),
  telemedLocations: z.array(z.string().min(1)),
  supportPhoneNumber: z.string().optional(),
  locationSupportPhoneNumberMap: z.record(z.string().min(1), z.string().min(1)).optional(),
  supportScheduleGroups: z
    .array(
      z.object({
        hours: z.string().min(1),
        locations: z.array(z.string().min(1)),
      })
    )
    .optional(),
});

export const LOCATION_CONFIG = Object.freeze(LocationConfigSchema.parse(mergedLocationConfig));

export const ALL_LOCATIONS = [...LOCATION_CONFIG.inPersonLocations, ...LOCATION_CONFIG.telemedLocations] as const;
export type LocationName = (typeof ALL_LOCATIONS)[number] | undefined;

export function getSupportPhoneFor(locationName?: string): string | undefined {
  const { locationSupportPhoneNumberMap, supportPhoneNumber } = LOCATION_CONFIG;

  if (locationSupportPhoneNumberMap && locationName) {
    // if the location exists but for some reason isn't in the map, fall back to the default support phone number
    return locationSupportPhoneNumberMap[locationName] || supportPhoneNumber;
  }

  return supportPhoneNumber;
}

export function getLocationNames(): string[] {
  const { locationSupportPhoneNumberMap } = LOCATION_CONFIG;

  if (locationSupportPhoneNumberMap == undefined) {
    return [];
  }

  return Object.keys(locationSupportPhoneNumberMap);
}

export function getSupportScheduleGroups(): Array<{ hours: string; locations: string[] }> {
  return LOCATION_CONFIG.supportScheduleGroups ?? [];
}

export function getSupportHoursFor(locationName?: string): string | undefined {
  const scheduleGroups = getSupportScheduleGroups();
  if (scheduleGroups.length === 0) {
    return;
  }

  if (locationName) {
    const normalizedLocationName = locationName.toLowerCase();
    const matchedGroup = scheduleGroups.find((group) =>
      group.locations.some((location) => location.toLowerCase() === normalizedLocationName)
    );

    if (matchedGroup) {
      return matchedGroup.hours;
    }
  }

  return scheduleGroups[0]?.hours;
}
