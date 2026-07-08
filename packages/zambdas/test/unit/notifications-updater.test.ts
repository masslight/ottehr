import { Appointment, Location, Practitioner, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CATEGORY_NOTIFICATION_TAG_CODE,
  CATEGORY_NOTIFICATION_TAG_SYSTEM,
  MANUAL_TASK,
  normalizeNotificationPreferencesV2,
  NotificationRowPref,
  ProviderNotificationMethod,
  ProviderNotificationSettings,
} from 'utils';
import { describe, expect, it } from 'vitest';
import {
  categoryNotifiedKey,
  communicationStatusForMethod,
  getCommunicationStatus,
  hasCategoryNotifiedTag,
  isTaskNewlyCreated,
  READY_OR_UNSIGNED_ENCOUNTER_STATUSES,
  resolveAssignmentDelivery,
  rowMatchesFilters,
  shouldEmitTelemedNotification,
} from '../../src/cron/notifications-updater';

const makeRow = (overrides: Partial<NotificationRowPref> = {}): NotificationRowPref => ({
  enabled: true,
  method: ProviderNotificationMethod.computer,
  locationIds: [],
  allLocations: true,
  assignedTo: 'anyone',
  ...overrides,
});

describe('rowMatchesFilters', () => {
  it('does not match when the row is disabled', () => {
    expect(rowMatchesFilters(makeRow({ enabled: false }), 'loc-1', true)).toBe(false);
  });

  it('matches any location when allLocations is true', () => {
    expect(rowMatchesFilters(makeRow({ allLocations: true }), 'loc-1', false)).toBe(true);
    expect(rowMatchesFilters(makeRow({ allLocations: true }), undefined, false)).toBe(true);
  });

  it('matches only listed locations otherwise, and never a location-less task', () => {
    expect(rowMatchesFilters(makeRow({ allLocations: false, locationIds: ['loc-1'] }), 'loc-1', false)).toBe(true);
    expect(rowMatchesFilters(makeRow({ allLocations: false, locationIds: ['loc-1'] }), 'loc-2', false)).toBe(false);
    expect(rowMatchesFilters(makeRow({ allLocations: false, locationIds: ['loc-1'] }), undefined, false)).toBe(false);
  });

  it('honors assignedTo=me only when the task is assigned to the recipient', () => {
    expect(rowMatchesFilters(makeRow({ assignedTo: 'me' }), 'loc-1', false)).toBe(false);
    expect(rowMatchesFilters(makeRow({ assignedTo: 'me' }), 'loc-1', true)).toBe(true);
    expect(rowMatchesFilters(makeRow({ assignedTo: 'anyone' }), 'loc-1', false)).toBe(true);
  });
});

describe('communicationStatusForMethod', () => {
  it("returns 'completed' for phone-only (drives SMS) and 'in-progress' otherwise", () => {
    expect(communicationStatusForMethod(ProviderNotificationMethod.phone)).toBe('completed');
    expect(communicationStatusForMethod(ProviderNotificationMethod.computer)).toBe('in-progress');
    expect(communicationStatusForMethod(ProviderNotificationMethod['phone and computer'])).toBe('in-progress');
    expect(communicationStatusForMethod(undefined)).toBe('in-progress');
  });
});

describe('notifications-updater encounter status filter', () => {
  it("includes 'planned' so the cron sees telemed appointments at booking time (OTR-2552)", () => {
    expect(READY_OR_UNSIGNED_ENCOUNTER_STATUSES).toContain('planned');
  });

  it("includes 'arrived' so the cron still sees telemed appointments after waiting-room entry", () => {
    expect(READY_OR_UNSIGNED_ENCOUNTER_STATUSES).toContain('arrived');
  });
});

describe('isTaskNewlyCreated', () => {
  const windowStart = DateTime.utc().minus({ hours: 1 });
  const makeTask = (authoredOn?: string): Task => ({
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    ...(authoredOn ? { authoredOn } : {}),
  });

  it('is true for a task authored within the window', () => {
    expect(isTaskNewlyCreated(makeTask(DateTime.utc().minus({ minutes: 5 }).toISO()!), windowStart)).toBe(true);
  });

  it('is false for an old task that was merely edited into the window', () => {
    expect(isTaskNewlyCreated(makeTask(DateTime.utc().minus({ days: 30 }).toISO()!), windowStart)).toBe(false);
  });

  it('is false when authoredOn is missing entirely', () => {
    expect(isTaskNewlyCreated(makeTask(), windowStart)).toBe(false);
  });
});

describe('hasCategoryNotifiedTag', () => {
  const baseTask: Task = { resourceType: 'Task', status: 'requested', intent: 'order' };

  it('detects the category-notified marker', () => {
    const task: Task = {
      ...baseTask,
      meta: { tag: [{ system: CATEGORY_NOTIFICATION_TAG_SYSTEM, code: CATEGORY_NOTIFICATION_TAG_CODE }] },
    };
    expect(hasCategoryNotifiedTag(task)).toBe(true);
  });

  it('ignores tags from other systems and untagged tasks', () => {
    const task: Task = {
      ...baseTask,
      meta: { tag: [{ system: 'https://example.com/other', code: CATEGORY_NOTIFICATION_TAG_CODE }] },
    };
    expect(hasCategoryNotifiedTag(task)).toBe(false);
    expect(hasCategoryNotifiedTag(baseTask)).toBe(false);
  });
});

describe('resolveAssignmentDelivery (two-engine coordination)', () => {
  const recipient: Practitioner = { resourceType: 'Practitioner', id: 'prac-1' };
  const billingTask = (overrides: Partial<Task> = {}): Task => ({
    resourceType: 'Task',
    id: 'task-1',
    status: 'requested',
    intent: 'order',
    owner: { reference: 'Practitioner/prac-1' },
    groupIdentifier: { value: MANUAL_TASK.category.billing },
    ...overrides,
  });
  const prefsWithBilling = (
    row: Partial<NotificationRowPref>
  ): ReturnType<typeof normalizeNotificationPreferencesV2> => {
    const prefs = normalizeNotificationPreferencesV2({});
    prefs.taskCategories.billing = { ...prefs.taskCategories.billing, ...makeRow(row) };
    return prefs;
  };
  const legacyEnabled: ProviderNotificationSettings = {
    method: ProviderNotificationMethod.phone,
    taskNotificationsEnabled: true,
    telemedNotificationsEnabled: true,
  };
  const baseInput = {
    task: billingTask(),
    recipient,
    hasExplicitPrefs: true,
    legacySettings: legacyEnabled,
    categoryNotifiedThisRun: new Set<string>(),
    taskLocationId: undefined,
  };

  it("delivers a matching 'me' subscription with the row's method", () => {
    const result = resolveAssignmentDelivery({
      ...baseInput,
      prefs: prefsWithBilling({ assignedTo: 'me', method: ProviderNotificationMethod.computer }),
    });
    expect(result).toEqual({ notify: true, method: ProviderNotificationMethod.computer });
  });

  it('defers when the category engine already notified this exact (task, practitioner) pair this run', () => {
    const result = resolveAssignmentDelivery({
      ...baseInput,
      prefs: prefsWithBilling({ assignedTo: 'anyone' }),
      categoryNotifiedThisRun: new Set([categoryNotifiedKey('task-1', 'prac-1')]),
    });
    expect(result).toEqual({ notify: false });
  });

  it("still delivers an 'anyone' subscription the category engine skipped (e.g. owner not in its active-staff population)", () => {
    // Regression: a deactivated-but-assigned owner must not be dropped by BOTH engines. The category
    // engine only iterates active staff; if it did not record the pair, the assignment engine delivers.
    const result = resolveAssignmentDelivery({
      ...baseInput,
      prefs: prefsWithBilling({ assignedTo: 'anyone', method: ProviderNotificationMethod.phone }),
      categoryNotifiedThisRun: new Set(), // category engine notified nobody about this task
    });
    expect(result).toEqual({ notify: true, method: ProviderNotificationMethod.phone });
  });

  it('does not deliver when the subscription row is disabled or its location filter excludes the task', () => {
    expect(resolveAssignmentDelivery({ ...baseInput, prefs: prefsWithBilling({ enabled: false }) })).toEqual({
      notify: false,
    });
    expect(
      resolveAssignmentDelivery({
        ...baseInput,
        prefs: prefsWithBilling({ allLocations: false, locationIds: ['loc-1'] }),
        taskLocationId: 'loc-2',
      })
    ).toEqual({ notify: false });
  });

  it('falls back to the legacy flag for an uncategorized task', () => {
    const uncategorized = billingTask({ groupIdentifier: { value: 'not-a-known-category' } });
    expect(
      resolveAssignmentDelivery({ ...baseInput, task: uncategorized, prefs: normalizeNotificationPreferencesV2({}) })
    ).toEqual({ notify: true, method: ProviderNotificationMethod.phone });
    expect(
      resolveAssignmentDelivery({
        ...baseInput,
        task: uncategorized,
        prefs: normalizeNotificationPreferencesV2({}),
        legacySettings: { ...legacyEnabled, taskNotificationsEnabled: false },
      })
    ).toEqual({ notify: false });
  });

  it('keeps legacy behavior for un-migrated staff', () => {
    expect(resolveAssignmentDelivery({ ...baseInput, hasExplicitPrefs: false, prefs: undefined })).toEqual({
      notify: true,
      method: ProviderNotificationMethod.phone,
    });
    expect(
      resolveAssignmentDelivery({
        ...baseInput,
        hasExplicitPrefs: false,
        prefs: undefined,
        legacySettings: { ...legacyEnabled, taskNotificationsEnabled: false },
      })
    ).toEqual({ notify: false });
  });
});

describe('shouldEmitTelemedNotification (booking / waiting-room gate)', () => {
  const TAG = { system: 'https://example.com/new-tag', code: 'notified' };
  const LEGACY_TAG = { system: 'https://example.com/legacy-tag', code: 'patient waiting' };
  const appointment = (tags: { system: string; code: string }[] = []): Appointment => ({
    resourceType: 'Appointment',
    status: 'booked',
    participant: [],
    ...(tags.length ? { meta: { tag: tags } } : {}),
  });
  const locationWithState: Location = { resourceType: 'Location', address: { state: 'MA' } };
  const locationWithoutState: Location = { resourceType: 'Location' };

  it('fires when untagged and the location has a state', () => {
    expect(shouldEmitTelemedNotification(appointment(), locationWithState, TAG)).toBe(true);
  });

  it('is idempotent: the primary tag suppresses re-firing', () => {
    expect(shouldEmitTelemedNotification(appointment([TAG]), locationWithState, TAG)).toBe(false);
  });

  it('treats a legacy alsoSkipIfTagged marker as already-notified (deploy transition)', () => {
    expect(
      shouldEmitTelemedNotification(appointment([LEGACY_TAG]), locationWithState, TAG, {
        alsoSkipIfTagged: [LEGACY_TAG],
      })
    ).toBe(false);
  });

  it('requires location.address.state by default (booking path)', () => {
    expect(shouldEmitTelemedNotification(appointment(), locationWithoutState, TAG)).toBe(false);
    expect(shouldEmitTelemedNotification(appointment(), undefined, TAG)).toBe(false);
  });

  it('fires without a location state when requireLocationState is false (waiting-room path)', () => {
    expect(
      shouldEmitTelemedNotification(appointment(), locationWithoutState, TAG, { requireLocationState: false })
    ).toBe(true);
    expect(shouldEmitTelemedNotification(appointment(), undefined, TAG, { requireLocationState: false })).toBe(true);
  });
});

describe('getCommunicationStatus', () => {
  const settings = (method: ProviderNotificationMethod): ProviderNotificationSettings => ({
    method,
    taskNotificationsEnabled: true,
    telemedNotificationsEnabled: true,
  });

  it("returns 'completed' for phone-only providers so SMS gets triggered", () => {
    expect(getCommunicationStatus(settings(ProviderNotificationMethod.phone))).toBe('completed');
  });

  it("returns 'in-progress' for 'phone and computer' providers so the badge still lights up", () => {
    expect(getCommunicationStatus(settings(ProviderNotificationMethod['phone and computer']))).toBe('in-progress');
  });

  it("returns 'in-progress' for 'computer' providers so the badge still lights up", () => {
    expect(getCommunicationStatus(settings(ProviderNotificationMethod.computer))).toBe('in-progress');
  });
});
