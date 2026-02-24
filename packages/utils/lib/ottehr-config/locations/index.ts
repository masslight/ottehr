import { type LocationConfig, LocationConfigSchema } from 'ottehr-types';
import { LOCATIONS_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';

const overrides = OVERRIDES || {};

const LOCATION_DEFAULTS: LocationConfig = {
  inPersonLocations: [{ name: 'New York' }, { name: 'Los Angeles' }],
  telemedLocations: [{ name: 'Telemed New Jersey' }, { name: 'Telemed Ohio' }],
  supportPhoneNumber: '(202) 555-1212',
  locationSupportPhoneNumberMap: {},
  supportScheduleGroups: [],
};

function getLocationConfig(testOverrides: Partial<LocationConfig> = overrides): LocationConfig {
  const mergedLocationConfig = mergeAndFreezeConfigObjects(LOCATION_DEFAULTS, testOverrides);
  return LocationConfigSchema.parse(mergedLocationConfig);
}

// Export the config directly (no proxy needed - static config for support contact display)
export const LOCATION_CONFIG = getLocationConfig();

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
