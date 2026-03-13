import { type LocationConfig, LocationConfigSchema, type SupportDialog, type SupportDisplay } from 'config-types';
import { LOCATIONS_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';

const overrides = OVERRIDES || {};
const DEFAULT_SUPPORT_DIALOG_TITLE = 'Need help?';
const DEFAULT_SUPPORT_DIALOG_EMERGENCY_NOTICE = 'If this is an emergency, please call 911.';
const DEFAULT_SUPPORT_HOURS = 'Sunday-Saturday 10am-10pm ET.';
type ResolvedSupportDialog = {
  title: string;
  sections: SupportDialog['sections'];
  emergencyNotice: string;
};

const LOCATION_DEFAULTS: LocationConfig = {
  inPersonLocations: [{ name: 'New York' }, { name: 'Los Angeles' }],
  telemedLocations: [{ name: 'Telemed New Jersey' }, { name: 'Telemed Ohio' }],
  supportPhoneNumber: '(202) 555-1212',
  locationSupportPhoneNumberMap: {},
  supportScheduleGroups: [],
  supportDialog: undefined,
  supportDisplay: undefined,
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
      hours: getSupportHoursFor() ?? DEFAULT_SUPPORT_HOURS,
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

export function getSupportDisplay(): SupportDisplay | undefined {
  return LOCATION_CONFIG.supportDisplay;
}

export function getSupportDialog(): ResolvedSupportDialog {
  const supportDialog = LOCATION_CONFIG.supportDialog;
  if (supportDialog) {
    return {
      title: supportDialog.title ?? DEFAULT_SUPPORT_DIALOG_TITLE,
      sections: supportDialog.sections,
      emergencyNotice: supportDialog.emergencyNotice ?? DEFAULT_SUPPORT_DIALOG_EMERGENCY_NOTICE,
    };
  }

  const customSupportDisplay = getSupportDisplay();
  if (customSupportDisplay) {
    return {
      title: DEFAULT_SUPPORT_DIALOG_TITLE,
      sections: [
        {
          rows: [
            {
              label: customSupportDisplay.phoneLabel ?? 'Call us',
              value: getSupportPhoneFor() ?? LOCATION_DEFAULTS.supportPhoneNumber ?? '',
            },
            ...customSupportDisplay.hours.map((hoursLine) => ({
              value: hoursLine,
              emphasized: true,
            })),
          ],
        },
      ],
      emergencyNotice: DEFAULT_SUPPORT_DIALOG_EMERGENCY_NOTICE,
    };
  }

  return {
    title: DEFAULT_SUPPORT_DIALOG_TITLE,
    sections: getSupportDisplayGroups().map((group) => ({
      rows: [
        ...group.locations.map((location) => ({
          label: location,
          value: getSupportPhoneFor(location) ?? LOCATION_DEFAULTS.supportPhoneNumber ?? '',
        })),
        {
          value: group.hours,
          emphasized: true,
        },
      ],
    })),
    emergencyNotice: DEFAULT_SUPPORT_DIALOG_EMERGENCY_NOTICE,
  };
}
