import { Practitioner } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  getAllNotificationRows,
  getUiTaskCategoryForCode,
  normalizeNotificationPreferencesV2,
  notificationRowMatchesLocation,
  PROVIDER_NOTIFICATION_PREFERENCES_V2_URL,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
  PROVIDER_TASK_NOTIFICATIONS_ENABLED_URL,
  ProviderNotificationMethod,
  UI_TASK_CATEGORY_IDS,
} from '../types';
import { getProviderNotificationPreferencesV2 } from './patient';

describe('getUiTaskCategoryForCode', () => {
  it('folds auto-generated and manual codes into the same UI category', () => {
    expect(getUiTaskCategoryForCode('external-lab')).toBe('externalLab');
    expect(getUiTaskCategoryForCode('manual-external-lab')).toBe('externalLab');
    expect(getUiTaskCategoryForCode('radiology')).toBe('radiology');
    expect(getUiTaskCategoryForCode('manual-radiology')).toBe('radiology');
    expect(getUiTaskCategoryForCode('erx')).toBe('erx');
  });

  it('returns undefined for unknown or missing codes', () => {
    expect(getUiTaskCategoryForCode('not-a-category')).toBeUndefined();
    expect(getUiTaskCategoryForCode(undefined)).toBeUndefined();
  });
});

describe('notificationRowMatchesLocation', () => {
  const row = (allLocations: boolean, locationIds: string[]): any => ({
    enabled: true,
    method: ProviderNotificationMethod.computer,
    allLocations,
    locationIds,
    assignedTo: 'anyone',
  });

  it('matches everything when allLocations is true', () => {
    expect(notificationRowMatchesLocation(row(true, []), 'loc-1')).toBe(true);
    expect(notificationRowMatchesLocation(row(true, []), undefined)).toBe(true);
  });

  it('matches only listed ids when not allLocations', () => {
    expect(notificationRowMatchesLocation(row(false, ['loc-1', 'loc-2']), 'loc-2')).toBe(true);
    expect(notificationRowMatchesLocation(row(false, ['loc-1']), 'loc-2')).toBe(false);
  });

  it('never matches a location-less task unless allLocations', () => {
    expect(notificationRowMatchesLocation(row(false, ['loc-1']), undefined)).toBe(false);
  });
});

describe('normalizeNotificationPreferencesV2', () => {
  it('fills in all task categories and the telemed top-level rows', () => {
    const normalized = normalizeNotificationPreferencesV2({});
    expect(Object.keys(normalized.taskCategories).sort()).toEqual([...UI_TASK_CATEGORY_IDS].sort());
    expect(normalized.virtualVisitScheduled).toBeDefined();
    expect(normalized.waitingRoom).toBeDefined();
  });

  it('defaults a partial row to disabled + all-locations + anyone', () => {
    const normalized = normalizeNotificationPreferencesV2({ waitingRoom: { enabled: true } as any });
    expect(normalized.waitingRoom.enabled).toBe(true);
    expect(normalized.waitingRoom.allLocations).toBe(true);
    expect(normalized.waitingRoom.assignedTo).toBe('anyone');
  });

  it('repairs an enabled row with allLocations=false and no locationIds to all-locations (would otherwise match nothing)', () => {
    const normalized = normalizeNotificationPreferencesV2({
      waitingRoom: { enabled: true, allLocations: false, locationIds: [] } as any,
    });
    expect(normalized.waitingRoom.allLocations).toBe(true);
  });

  it('keeps an explicit location list intact (allLocations stays false)', () => {
    const normalized = normalizeNotificationPreferencesV2({
      waitingRoom: { enabled: true, allLocations: false, locationIds: ['loc-1'] } as any,
    });
    expect(normalized.waitingRoom.allLocations).toBe(false);
    expect(normalized.waitingRoom.locationIds).toEqual(['loc-1']);
  });
});

describe('getAllNotificationRows', () => {
  it('returns the two telemed rows plus every task-category row', () => {
    const prefs = normalizeNotificationPreferencesV2({});
    expect(getAllNotificationRows(prefs)).toHaveLength(UI_TASK_CATEGORY_IDS.length + 2);
  });

  it('reflects each row’s enabled flag and method', () => {
    const prefs = normalizeNotificationPreferencesV2({});
    prefs.waitingRoom.enabled = true;
    prefs.taskCategories.billing = {
      ...prefs.taskCategories.billing,
      enabled: true,
      method: ProviderNotificationMethod.phone,
    };
    const enabled = getAllNotificationRows(prefs).filter((row) => row.enabled);
    expect(enabled).toHaveLength(2);
    expect(enabled.some((row) => row.method === ProviderNotificationMethod.phone)).toBe(true);
  });
});

describe('getProviderNotificationPreferencesV2', () => {
  it('parses the V2 JSON blob when present', () => {
    const prefs = normalizeNotificationPreferencesV2({});
    prefs.taskCategories.radiology.enabled = true;
    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      extension: [
        {
          url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
          extension: [{ url: PROVIDER_NOTIFICATION_PREFERENCES_V2_URL, valueString: JSON.stringify(prefs) }],
        },
      ],
    };
    const result = getProviderNotificationPreferencesV2(practitioner);
    expect(result?.taskCategories.radiology.enabled).toBe(true);
  });

  it('falls back to legacy flags for an un-migrated practitioner', () => {
    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      extension: [
        {
          url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
          extension: [{ url: PROVIDER_TASK_NOTIFICATIONS_ENABLED_URL, valueBoolean: true }],
        },
      ],
    };
    const result = getProviderNotificationPreferencesV2(practitioner);
    // legacy taskNotificationsEnabled=true → every task category defaults to enabled
    expect(UI_TASK_CATEGORY_IDS.every((id) => result?.taskCategories[id].enabled)).toBe(true);
  });

  it('returns undefined when there is no practitioner', () => {
    expect(getProviderNotificationPreferencesV2(undefined)).toBeUndefined();
  });
});
