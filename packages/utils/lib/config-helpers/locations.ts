import type { LocationConfig, SupportDialog, SupportScheduleGroup } from 'config-types';

const DEFAULT_SUPPORT_DIALOG_TITLE = 'Need help?';
const DEFAULT_SUPPORT_DIALOG_EMERGENCY_NOTICE = 'If this is an emergency, please call 911.';

export type ResolvedSupportDialog = {
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

export type LocationSupportHelpers = {
  getSupportPhoneFor: (locationName?: string) => string | undefined;
  getSupportScheduleGroups: () => SupportScheduleGroup[];
  getSupportDialog: () => ResolvedSupportDialog;
};

export function createLocationSupportHelpers(locationConfig: LocationConfig): LocationSupportHelpers {
  function getSupportPhoneFor(locationName?: string): string | undefined {
    const { locationSupportPhoneNumberMap, supportPhoneNumber } = locationConfig;

    if (!locationName) {
      return supportPhoneNumber;
    }

    return locationSupportPhoneNumberMap?.[locationName] || supportPhoneNumber;
  }

  function getSupportScheduleGroups(): SupportScheduleGroup[] {
    return locationConfig.supportScheduleGroups ?? [];
  }

  function getSupportScheduleGroup(groupIndex: number): { hoursLines: string[]; locations: string[] } {
    const group = getSupportScheduleGroups()[groupIndex];

    if (!group) {
      throw new Error(`Invalid support dialog config: schedule group ${groupIndex} does not exist.`);
    }

    return {
      hoursLines: group.hoursLines ?? [group.hours ?? ''],
      locations: group.locations,
    };
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
    return rows.flatMap((row): ResolvedSupportDialogRow[] => {
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
      }
    });
  }

  function getSupportDialog(): ResolvedSupportDialog {
    const supportDialog = locationConfig.supportDialog;

    if (!supportDialog) {
      throw new Error('Invalid support dialog config: supportDialog is required.');
    }

    return {
      title: supportDialog.title ?? DEFAULT_SUPPORT_DIALOG_TITLE,
      sections: supportDialog.sections.map((section) => ({
        rows: resolveSupportDialogRows(section.rows),
      })),
      emergencyNotice: supportDialog.emergencyNotice ?? DEFAULT_SUPPORT_DIALOG_EMERGENCY_NOTICE,
    };
  }

  return {
    getSupportPhoneFor,
    getSupportScheduleGroups,
    getSupportDialog,
  };
}
