import * as z from 'zod';
import { LOCATIONS_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';

const overrides: any = OVERRIDES || {};

const LOCATION_DEFAULTS: any = {
  inPersonLocations: [{ name: 'New York' }, { name: 'Los Angeles' }],
  telemedLocations: [{ name: 'Telemed New Jersey' }, { name: 'Telemed Ohio' }],
  supportPhoneNumber: '(202) 555-1212',
  supportScheduleGroups: [],
};

const mergedLocationConfig = mergeAndFreezeConfigObjects(LOCATION_DEFAULTS, overrides);

const locationArraySchema = z.array(
  z.object({
    name: z.string().min(1, { message: 'Location name cannot be empty' }),
  })
);
const LocationConfigSchema = z.object({
  inPersonLocations: locationArraySchema,
  telemedLocations: locationArraySchema,
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

export function getSupportPhoneFor(locationName?: string): string | undefined {
  const { locationSupportPhoneNumberMap, supportPhoneNumber } = LOCATION_CONFIG;

  if (locationSupportPhoneNumberMap && locationName) {
    return locationSupportPhoneNumberMap[locationName] || supportPhoneNumber;
  }

  return supportPhoneNumber;
}

export function getSupportScheduleGroups(): Array<{ hours: string; locations: string[] }> {
  return LOCATION_CONFIG.supportScheduleGroups ?? [];
}

export function getSupportDisplayGroups(): Array<{ hours: string; locations: string[] }> {
  const groups = getSupportScheduleGroups();
  if (groups.length > 0) {
    return groups;
  }

  return [
    {
      hours: getSupportHoursFor() ?? 'Sunday-Saturday 10am-10pm ET.',
      locations: ALL_LOCATIONS.map((location) => location.name),
    },
  ];
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
