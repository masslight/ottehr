import type { LocationConfig, SupportDialog } from 'config-types';

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

const LOCATION_DATA: LocationConfig = {
  inPersonLocations: [{ name: 'New York' }, { name: 'Los Angeles' }],
  telemedLocations: [{ name: 'Telemed New Jersey' }, { name: 'Telemed Ohio' }],
  supportPhoneNumber: DEFAULT_SUPPORT_PHONE,
  locationSupportPhoneNumberMap: {},
  supportScheduleGroups: [],
  supportDialog: undefined,
};

export const LOCATION_CONFIG = Object.freeze(LOCATION_DATA);

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
              value: getSupportPhoneFor() ?? LOCATION_DATA.supportPhoneNumber ?? DEFAULT_SUPPORT_PHONE,
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
          value: getSupportPhoneFor(location) ?? LOCATION_DATA.supportPhoneNumber ?? '',
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
