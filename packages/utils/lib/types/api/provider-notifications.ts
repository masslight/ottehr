import { IN_HOUSE_LAB_TASK } from '../data/in-house/in-house.constants';
import { LAB_ORDER_TASK } from '../data/labs/labs.constants';
import { ERX_TASK, MANUAL_TASK, RADIOLOGY_TASK } from '../data/tasks/types';
import { ProviderNotificationMethod } from './practitioner.types';

/**
 * Per-notification-type registration for staff: each type carries a delivery method, location
 * filter, and "assigned to" filter. Persisted as one JSON string in a child extension of
 * `PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL` (see `getProviderNotificationPreferencesV2`).
 */

export type NotificationAssignedTo = 'me' | 'anyone';

export interface NotificationRowPref {
  enabled: boolean;
  method: ProviderNotificationMethod;
  /** Explicit location ids to match. Ignored when `allLocations` is true. */
  locationIds: string[];
  /** When true, match tasks at any location regardless of `locationIds`. */
  allLocations: boolean;
  assignedTo: NotificationAssignedTo;
}

/** Stable ids for the 12 task categories shown in the settings table (ordered as in the design mock). */
export const UI_TASK_CATEGORY_IDS = [
  'externalLab',
  'inHouseLab',
  'radiology',
  'erx',
  'inHouseMedications',
  'nursingOrders',
  'patientFollowUp',
  'procedures',
  'charting',
  'coding',
  'billing',
  'other',
] as const;
export type UiTaskCategoryId = (typeof UI_TASK_CATEGORY_IDS)[number];

export const UI_TASK_CATEGORY_LABELS: Record<UiTaskCategoryId, string> = {
  externalLab: 'External Lab',
  inHouseLab: 'In-house Lab',
  radiology: 'Radiology',
  erx: 'eRX',
  inHouseMedications: 'In-house Medications',
  nursingOrders: 'Nursing Orders',
  patientFollowUp: 'Patient Follow-up',
  procedures: 'Procedures',
  charting: 'Charting',
  coding: 'Coding',
  billing: 'Billing',
  other: 'Other',
};

/**
 * Maps a `Task.groupIdentifier.value` category code to a UI category id. Several task-category codes fold
 * into one UI category (e.g. auto-generated `external-lab` and `manual-external-lab` → "External Lab").
 */
export const TASK_CODE_TO_UI_CATEGORY: Record<string, UiTaskCategoryId> = {
  [LAB_ORDER_TASK.category]: 'externalLab',
  [MANUAL_TASK.category.externalLab]: 'externalLab',
  [IN_HOUSE_LAB_TASK.category]: 'inHouseLab',
  [MANUAL_TASK.category.inHouseLab]: 'inHouseLab',
  [RADIOLOGY_TASK.category]: 'radiology',
  [MANUAL_TASK.category.radiology]: 'radiology',
  [ERX_TASK.category]: 'erx',
  [MANUAL_TASK.category.erx]: 'erx',
  [MANUAL_TASK.category.inHouseMedications]: 'inHouseMedications',
  [MANUAL_TASK.category.nursingOrders]: 'nursingOrders',
  [MANUAL_TASK.category.patientFollowUp]: 'patientFollowUp',
  [MANUAL_TASK.category.procedures]: 'procedures',
  [MANUAL_TASK.category.charting]: 'charting',
  [MANUAL_TASK.category.coding]: 'coding',
  [MANUAL_TASK.category.billing]: 'billing',
  [MANUAL_TASK.category.other]: 'other',
};

export const getUiTaskCategoryForCode = (code: string | undefined): UiTaskCategoryId | undefined =>
  code ? TASK_CODE_TO_UI_CATEGORY[code] : undefined;

export interface ProviderNotificationPreferencesV2 {
  version: 2;
  virtualVisitScheduled: NotificationRowPref;
  waitingRoom: NotificationRowPref;
  taskCategories: Record<UiTaskCategoryId, NotificationRowPref>;
}

// The V2 extension URL, tag systems, and category coding system live in `practitioner.types.ts` alongside the
// sibling `provider-notifications-*` family (re-exported from the same barrel).

export const defaultNotificationRowPref = (
  enabled: boolean,
  method: ProviderNotificationMethod
): NotificationRowPref => ({
  enabled,
  method,
  locationIds: [],
  allLocations: true,
  assignedTo: 'anyone',
});

export const buildDefaultTaskCategoryPrefs = (
  enabled: boolean,
  method: ProviderNotificationMethod
): Record<UiTaskCategoryId, NotificationRowPref> => {
  const rows = {} as Record<UiTaskCategoryId, NotificationRowPref>;
  for (const id of UI_TASK_CATEGORY_IDS) {
    rows[id] = defaultNotificationRowPref(enabled, method);
  }
  return rows;
};

/**
 * Defensively fill in any missing rows/fields so callers can rely on a complete object even if the stored
 * JSON blob was written by an older version or is partial.
 */
export const normalizeNotificationPreferencesV2 = (
  prefs: Partial<ProviderNotificationPreferencesV2> | undefined,
  fallbackMethod: ProviderNotificationMethod = ProviderNotificationMethod['phone and computer']
): ProviderNotificationPreferencesV2 => {
  const normalizeRow = (row: Partial<NotificationRowPref> | undefined): NotificationRowPref => {
    const locationIds = Array.isArray(row?.locationIds) ? row!.locationIds : [];
    return {
      enabled: row?.enabled ?? false,
      method: row?.method ?? fallbackMethod,
      locationIds,
      // An empty location list always reads as "all locations" — an enabled row must never match nothing.
      allLocations: locationIds.length === 0 ? true : row?.allLocations ?? false,
      assignedTo: row?.assignedTo === 'me' ? 'me' : 'anyone',
    };
  };
  const taskCategories = {} as Record<UiTaskCategoryId, NotificationRowPref>;
  for (const id of UI_TASK_CATEGORY_IDS) {
    taskCategories[id] = normalizeRow(prefs?.taskCategories?.[id]);
  }
  return {
    version: 2,
    virtualVisitScheduled: normalizeRow(prefs?.virtualVisitScheduled),
    waitingRoom: normalizeRow(prefs?.waitingRoom),
    taskCategories,
  };
};

/** Roll the per-row methods up to a single legacy `method` so old consumers keep a sane value. */
export const rollupLegacyNotificationMethod = (
  prefs: ProviderNotificationPreferencesV2
): ProviderNotificationMethod => {
  const enabledMethods: ProviderNotificationMethod[] = [
    prefs.virtualVisitScheduled,
    prefs.waitingRoom,
    ...UI_TASK_CATEGORY_IDS.map((id) => prefs.taskCategories[id]),
  ]
    .filter((row) => row.enabled)
    .map((row) => row.method);
  const hasPhone = enabledMethods.some(
    (m) => m === ProviderNotificationMethod.phone || m === ProviderNotificationMethod['phone and computer']
  );
  const hasComputer = enabledMethods.some(
    (m) => m === ProviderNotificationMethod.computer || m === ProviderNotificationMethod['phone and computer']
  );
  if (hasPhone && hasComputer) return ProviderNotificationMethod['phone and computer'];
  if (hasPhone) return ProviderNotificationMethod.phone;
  if (hasComputer) return ProviderNotificationMethod.computer;
  return ProviderNotificationMethod['phone and computer'];
};

/** Derive the legacy boolean flags (task/telemed enabled) from V2 preferences for backward compatibility. */
export const deriveLegacyNotificationFlagsFromV2 = (
  prefs: ProviderNotificationPreferencesV2
): { taskNotificationsEnabled: boolean; telemedNotificationsEnabled: boolean } => ({
  taskNotificationsEnabled: UI_TASK_CATEGORY_IDS.some((id) => prefs.taskCategories[id].enabled),
  telemedNotificationsEnabled: prefs.waitingRoom.enabled || prefs.virtualVisitScheduled.enabled,
});

/**
 * Whether a notification row's location filter matches a given task/appointment location id.
 * A row with `allLocations` matches everything; a row with an explicit list matches only listed ids; a task
 * with no location (undefined) only matches `allLocations` rows.
 */
export const notificationRowMatchesLocation = (row: NotificationRowPref, locationId: string | undefined): boolean => {
  if (row.allLocations) return true;
  return locationId != null && row.locationIds.includes(locationId);
};
