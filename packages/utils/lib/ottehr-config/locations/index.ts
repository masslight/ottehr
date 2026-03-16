import { type LocationConfig, LocationConfigSchema, type SupportDialog } from 'config-types';
import { LOCATIONS_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';

const overrides = OVERRIDES || {};
const DEFAULT_SUPPORT_DIALOG_TITLE = 'Need help?';
const DEFAULT_SUPPORT_DIALOG_EMERGENCY_NOTICE = 'If this is an emergency, please call 911.';
const DEFAULT_SUPPORT_HOURS = 'Sunday-Saturday 10am-10pm ET.';
const DEFAULT_SUPPORT_PHONE = '(202) 555-1212';

type ResolvedSupportDialog = {
  title: string;
  sections: Array<{
    rows: Array<{
      label?: string;
      value: string;
      emphasized?: boolean;
    }>;
  }>;
  emergencyNotice: string;
};
type ResolvedSupportDialogRow = ResolvedSupportDialog['sections'][number]['rows'][number];

const LOCATION_DEFAULTS: LocationConfig = {
  inPersonLocations: [{ name: 'New York' }, { name: 'Los Angeles' }],
  telemedLocations: [{ name: 'Telemed New Jersey' }, { name: 'Telemed Ohio' }],
  supportPhoneNumber: DEFAULT_SUPPORT_PHONE,
  locationSupportPhoneNumberMap: {},
  supportScheduleGroups: [],
  supportDialog: undefined,
};

function getLocationConfig(testOverrides: Partial<LocationConfig> = overrides): LocationConfig {
  const mergedLocationConfig = mergeAndFreezeConfigObjects(LOCATION_DEFAULTS, testOverrides);
  const parsedLocationConfig = LocationConfigSchema.parse(mergedLocationConfig);

  validateSupportDialog(parsedLocationConfig);

  return parsedLocationConfig;
}

// Export the config directly (no proxy needed - static config for support contact display)
export const LOCATION_CONFIG = getLocationConfig();

function getNormalizedSupportScheduleGroups(): Array<{ hoursLines: string[]; locations: string[] }> {
  return (LOCATION_CONFIG.supportScheduleGroups ?? []).map((group) => ({
    hoursLines: group.hoursLines ?? [group.hours ?? DEFAULT_SUPPORT_HOURS],
    locations: group.locations,
  }));
}

function getSupportScheduleGroup(groupIndex: number): { hoursLines: string[]; locations: string[] } {
  const group = getNormalizedSupportScheduleGroups()[groupIndex];

  if (!group) {
    throw new Error(`Invalid support dialog config: schedule group ${groupIndex} does not exist.`);
  }

  return group;
}

function formatSupportValue(value: string, suffixText?: string): string {
  return suffixText ? `${value}${suffixText}` : value;
}

function resolveLocationPhone(location: string, suffixText?: string): { label: string; value: string } {
  const supportPhone = getSupportPhoneFor(location);

  if (!supportPhone) {
    throw new Error(`Invalid support dialog config: no support phone configured for location "${location}".`);
  }

  return {
    label: location,
    value: formatSupportValue(supportPhone, suffixText),
  };
}

function resolveSupportDialogRows(
  rows: SupportDialog['sections'][number]['rows']
): ResolvedSupportDialog['sections'][number]['rows'] {
  return rows.flatMap<ResolvedSupportDialogRow>((row) => {
    switch (row.type) {
      case 'supportPhone': {
        const supportPhone = getSupportPhoneFor();

        if (!supportPhone) {
          throw new Error('Invalid support dialog config: supportPhone row requires supportPhoneNumber.');
        }

        return [
          {
            label: row.label ?? 'Call us',
            value: formatSupportValue(supportPhone, row.suffixText),
          },
        ];
      }
      case 'locationPhone':
        return [resolveLocationPhone(row.location, row.suffixText)];
      case 'scheduleGroupHours':
        return getSupportScheduleGroup(row.groupIndex).hoursLines.map((hoursLine) => ({
          value: hoursLine,
          emphasized: true,
        }));
      case 'locationPhonesForGroup':
        return getSupportScheduleGroup(row.groupIndex).locations.map((location) => resolveLocationPhone(location));
      default:
        return [];
    }
  });
}

function validateSupportDialog(config: LocationConfig): void {
  if (!config.supportDialog) {
    return;
  }

  const scheduleGroups = config.supportScheduleGroups ?? [];
  const locationSupportPhoneNumberMap = config.locationSupportPhoneNumberMap ?? {};

  config.supportDialog.sections.forEach((section, sectionIndex) => {
    section.rows.forEach((row, rowIndex) => {
      const rowPath = `supportDialog.sections[${sectionIndex}].rows[${rowIndex}]`;

      if (row.type === 'scheduleGroupHours' || row.type === 'locationPhonesForGroup') {
        const group = scheduleGroups[row.groupIndex];

        if (!group) {
          throw new Error(`Invalid ${rowPath}: schedule group ${row.groupIndex} does not exist.`);
        }

        if (row.type === 'locationPhonesForGroup' && group.locations.length === 0) {
          throw new Error(`Invalid ${rowPath}: schedule group ${row.groupIndex} has no locations to render.`);
        }

        return;
      }

      if (row.type === 'supportPhone' && !config.supportPhoneNumber) {
        throw new Error(`Invalid ${rowPath}: supportPhoneNumber is required for supportPhone rows.`);
      }

      if (row.type === 'locationPhone' && !locationSupportPhoneNumberMap[row.location] && !config.supportPhoneNumber) {
        throw new Error(`Invalid ${rowPath}: no support phone configured for location "${row.location}".`);
      }
    });
  });
}

export function getSupportPhoneFor(locationName?: string): string | undefined {
  const { locationSupportPhoneNumberMap, supportPhoneNumber } = LOCATION_CONFIG;

  if (!locationName) {
    return supportPhoneNumber;
  }

  const phoneFromMap = locationSupportPhoneNumberMap?.[locationName];

  return phoneFromMap || supportPhoneNumber;
}

export function getSupportDialog(): ResolvedSupportDialog {
  const supportDialog = LOCATION_CONFIG.supportDialog;
  if (supportDialog) {
    return {
      title: supportDialog.title ?? DEFAULT_SUPPORT_DIALOG_TITLE,
      sections: supportDialog.sections.map((section) => ({
        rows: resolveSupportDialogRows(section.rows),
      })),
      emergencyNotice: supportDialog.emergencyNotice ?? DEFAULT_SUPPORT_DIALOG_EMERGENCY_NOTICE,
    };
  }

  const normalizedScheduleGroups = getNormalizedSupportScheduleGroups();
  if (normalizedScheduleGroups.length === 0) {
    return {
      title: DEFAULT_SUPPORT_DIALOG_TITLE,
      sections: [
        {
          rows: [
            {
              label: 'Call us',
              value: getSupportPhoneFor() ?? LOCATION_DEFAULTS.supportPhoneNumber ?? DEFAULT_SUPPORT_PHONE,
            },
            {
              value: DEFAULT_SUPPORT_HOURS,
              emphasized: true,
            },
          ],
        },
      ],
      emergencyNotice: DEFAULT_SUPPORT_DIALOG_EMERGENCY_NOTICE,
    };
  }

  return {
    title: DEFAULT_SUPPORT_DIALOG_TITLE,
    sections: normalizedScheduleGroups.map((group) => ({
      rows: [
        ...group.locations.map((location) => ({
          label: location,
          value: getSupportPhoneFor(location) ?? LOCATION_DEFAULTS.supportPhoneNumber ?? '',
        })),
        ...group.hoursLines.map((hoursLine) => ({
          value: hoursLine,
          emphasized: true,
        })),
      ],
    })),
    emergencyNotice: DEFAULT_SUPPORT_DIALOG_EMERGENCY_NOTICE,
  };
}
