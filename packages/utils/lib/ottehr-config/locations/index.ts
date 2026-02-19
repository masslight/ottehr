import * as z from 'zod';
import { LOCATIONS_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';
import { CONFIG_INJECTION_KEYS, createProxyConfigObject, mergeAndFreezeConfigObjects } from '../helpers';

const overrides = OVERRIDES || {};

const LOCATION_DEFAULTS = {
  inPersonLocations: [{ name: 'New York' }, { name: 'Los Angeles' }],
  telemedLocations: [{ name: 'Telemed New Jersey' }, { name: 'Telemed Ohio' }],
  supportPhoneNumber: '(202) 555-1212',
  locationSupportPhoneNumberMap: {} as Record<string, string>,
  supportScheduleGroups: [],
} as const;

function getLocationConfig(testOverrides: any = overrides): any {
  const mergedLocationConfig = mergeAndFreezeConfigObjects(LOCATION_DEFAULTS, testOverrides);

  return LocationConfigSchema.parse(mergedLocationConfig);
}

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

export type LocationConfig = z.infer<typeof LocationConfigSchema>;

export const LOCATION_CONFIG = createProxyConfigObject<LocationConfig>(
  getLocationConfig,
  CONFIG_INJECTION_KEYS.LOCATIONS
);

export const ALL_LOCATIONS = [...LOCATION_CONFIG.inPersonLocations, ...LOCATION_CONFIG.telemedLocations] as const;

export function getSupportPhoneFor(locationName?: string): string | undefined {
  const { locationSupportPhoneNumberMap, supportPhoneNumber } = LOCATION_CONFIG;

  if (!locationName) {
    return supportPhoneNumber;
  }

  const phoneFromMap = locationSupportPhoneNumberMap?.[locationName];

  return phoneFromMap || supportPhoneNumber;
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
