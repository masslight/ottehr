import Oystehr from '@oystehr/sdk';
import type { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Practitioner, Resource, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AppointmentProviderNotificationTypes,
  PROVIDER_NOTIFICATION_METHOD_URL,
  PROVIDER_NOTIFICATION_PREFERENCES_V2_URL,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
  PROVIDER_TASK_NOTIFICATIONS_ENABLED_URL,
  ProviderNotificationMethod,
  TASK_NOTE_NOTIFIED_TAG_CODE,
  TASK_NOTE_NOTIFIED_TAG_SYSTEM,
} from 'utils/lib/types/api/practitioner.types';
import { normalizeNotificationPreferencesV2, NotificationRowPref } from 'utils/lib/types/api/provider-notifications';
import { RoleType } from 'utils/lib/types/api/user.types';
import { MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRecentTaskNotes,
  resolveTaskNoteDelivery,
  resolveTaskNoteRecipientIds,
} from '../../src/cron/notifications-updater';
import { TASK_NOTE_READ_BY_TAG_SYSTEM, TASK_NOTE_TAG } from '../../src/shared/notes';
import { createTask } from '../../src/shared/tasks';
import type { ZambdaInput } from '../../src/shared/types/common';
import { getEmployees, getRoleMembers, getRoles } from '../../src/shared/users.helper';

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-m2m-token') };
});

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => oystehr) };
});

vi.mock('../../src/shared/sentry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn };
});

vi.mock('../../src/shared/users.helper', () => ({
  getEmployees: vi.fn(),
  getRoles: vi.fn(),
  getRoleMembers: vi.fn(),
}));

const searchResults = new Map<string, { matches: Resource[]; includes?: Resource[] }>();
const bundle = ({ matches, includes = [] }: { matches: Resource[]; includes?: Resource[] }): object => ({
  total: matches.length,
  entry: [
    ...matches.map((resource) => ({ resource, search: { mode: 'match' } })),
    ...includes.map((resource) => ({ resource, search: { mode: 'include' } })),
  ],
  unbundle: () => [...matches, ...includes],
});
const oystehr = {
  fhir: {
    search: vi.fn(async ({ resourceType }: { resourceType: string }) =>
      bundle(searchResults.get(resourceType) ?? { matches: [] })
    ),
    transaction: vi.fn(),
  },
  transactionalSMS: { send: vi.fn() },
};

const { index: notificationsUpdater } = (await import('../../src/cron/notifications-updater')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

const windowStart = DateTime.utc().minus({ hours: 1 });
const minutesAgo = (minutes: number): string => DateTime.utc().minus({ minutes }).toISO()!;
const [TASK_NOTE_SYSTEM, TASK_NOTE_CODE] = TASK_NOTE_TAG.split('|');
const TASK_TITLE = 'Call payer about denied claim';

const task: Task = {
  ...createTask({ category: MANUAL_TASK.category.billing, title: TASK_TITLE, location: { id: 'loc-1' } }),
  id: 'task-1',
  owner: { reference: 'Practitioner/assignee' },
  requester: { reference: 'Practitioner/creator' },
};

const note = (id: string, author: string, overrides: Partial<Communication> = {}): Communication => ({
  resourceType: 'Communication',
  id,
  status: 'completed',
  meta: { tag: [{ system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE }] },
  basedOn: [{ reference: `Task/${task.id}` }],
  sender: { reference: `Practitioner/${author}` },
  sent: minutesAgo(2),
  payload: [{ contentString: `Private details from ${author}` }],
  ...overrides,
});

const readBy = (...practitionerIds: string[]): Partial<Communication> => ({
  meta: {
    tag: [
      { system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE },
      ...practitionerIds.map((code) => ({ system: TASK_NOTE_READ_BY_TAG_SYSTEM, code })),
    ],
  },
});

const billingRow = (row: Partial<NotificationRowPref> = {}): NotificationRowPref => ({
  enabled: true,
  method: ProviderNotificationMethod.computer,
  locationIds: [],
  allLocations: true,
  assignedTo: 'me',
  ...row,
});

const prefsWithBilling = (
  row: Partial<NotificationRowPref> = {}
): ReturnType<typeof normalizeNotificationPreferencesV2> => {
  const prefs = normalizeNotificationPreferencesV2({});
  prefs.taskCategories.billing = billingRow(row);
  return prefs;
};

const migratedStaff = (id: string, row: Partial<NotificationRowPref> = {}): Practitioner => ({
  resourceType: 'Practitioner',
  id,
  extension: [
    {
      url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
      extension: [
        { url: PROVIDER_NOTIFICATION_PREFERENCES_V2_URL, valueString: JSON.stringify(prefsWithBilling(row)) },
      ],
    },
  ],
});

const legacyPhoneStaff = (id: string): Practitioner => ({
  resourceType: 'Practitioner',
  id,
  telecom: [{ system: 'sms', value: '+15555550100' }],
  extension: [
    {
      url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
      extension: [
        { url: PROVIDER_NOTIFICATION_METHOD_URL, valueString: ProviderNotificationMethod.phone },
        { url: PROVIDER_TASK_NOTIFICATIONS_ENABLED_URL, valueBoolean: true },
      ],
    },
  ],
});

const decodePatch = (data: string): unknown => JSON.parse(atob(data));

beforeEach(() => {
  vi.clearAllMocks();
  searchResults.clear();
});

describe('resolveTaskNoteRecipientIds', () => {
  it("names the assignee, the creator and every note author once, but not the note's author", () => {
    const newNote = note('new', 'writer');
    const notesOnTask = [note('a', 'earlier'), note('b', 'writer'), note('c', 'assignee'), newNote];

    expect(resolveTaskNoteRecipientIds(task, notesOnTask, newNote).sort()).toEqual(['assignee', 'creator', 'earlier']);
  });

  it('leaves out anyone who has already read the note', () => {
    const newNote = note('new', 'writer', readBy('assignee'));

    expect(resolveTaskNoteRecipientIds(task, [newNote], newNote)).toEqual(['creator']);
  });

  it('falls back to the note authors on an unassigned task that predates recorded creators', () => {
    const legacyTask: Task = { ...task, owner: undefined, requester: undefined };
    const newNote = note('new', 'writer');

    expect(resolveTaskNoteRecipientIds(legacyTask, [note('a', 'earlier'), newNote], newNote)).toEqual(['earlier']);
  });

  it('ignores a requester that is not a practitioner, as on system-created tasks', () => {
    const systemTask: Task = { ...task, requester: { reference: 'Device/rules-engine' } };
    const newNote = note('new', 'writer');

    expect(resolveTaskNoteRecipientIds(systemTask, [newNote], newNote)).toEqual(['assignee']);
  });
});

describe('resolveTaskNoteDelivery', () => {
  const migrated = { hasExplicitPrefs: true, legacySettings: undefined, uiCategory: 'billing' as const };

  it("treats involvement as assignment, so a 'me' row for the task's category delivers", () => {
    expect(
      resolveTaskNoteDelivery({ ...migrated, prefs: prefsWithBilling({ assignedTo: 'me' }), taskLocationId: 'loc-1' })
    ).toEqual({ notify: true, method: ProviderNotificationMethod.computer });
  });

  it("follows the row's on/off switch and locations", () => {
    const atLoc1 = prefsWithBilling({ allLocations: false, locationIds: ['loc-1'] });
    expect(resolveTaskNoteDelivery({ ...migrated, prefs: atLoc1, taskLocationId: 'loc-2' })).toEqual({ notify: false });
    expect(
      resolveTaskNoteDelivery({ ...migrated, prefs: prefsWithBilling({ enabled: false }), taskLocationId: 'loc-1' })
    ).toEqual({ notify: false });
  });

  it('uses the legacy task flag for un-migrated staff and for uncategorized tasks', () => {
    const legacySettings = {
      method: ProviderNotificationMethod.phone,
      taskNotificationsEnabled: true,
      telemedNotificationsEnabled: false,
    };
    const prefs = prefsWithBilling({ enabled: false });
    const delivered = { notify: true, method: ProviderNotificationMethod.phone };

    expect(
      resolveTaskNoteDelivery({ ...migrated, hasExplicitPrefs: false, prefs, legacySettings, taskLocationId: 'loc-1' })
    ).toEqual(delivered);
    expect(
      resolveTaskNoteDelivery({ ...migrated, uiCategory: undefined, prefs, legacySettings, taskLocationId: 'loc-1' })
    ).toEqual(delivered);
    expect(
      resolveTaskNoteDelivery({
        ...migrated,
        hasExplicitPrefs: false,
        prefs,
        legacySettings: { ...legacySettings, taskNotificationsEnabled: false },
        taskLocationId: 'loc-1',
      })
    ).toEqual({ notify: false });
  });
});

describe('getRecentTaskNotes', () => {
  it("returns this window's un-notified notes with every live note on their tasks", async () => {
    const fresh = note('fresh', 'writer');
    const notified = note('notified', 'writer', {
      meta: {
        tag: [
          { system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE },
          { system: TASK_NOTE_NOTIFIED_TAG_SYSTEM, code: TASK_NOTE_NOTIFIED_TAG_CODE },
        ],
      },
    });
    const older = note('older', 'earlier', { sent: DateTime.utc().minus({ days: 3 }).toISO()! });
    const deleted = note('deleted', 'ghost', { status: 'entered-in-error' });
    const assignmentNotice: Communication = {
      resourceType: 'Communication',
      id: 'assignment-notice',
      status: 'in-progress',
      basedOn: [{ reference: `Task/${task.id}` }],
      sender: { reference: 'Practitioner/system' },
    };
    searchResults.set('Communication', {
      matches: [fresh, notified],
      includes: [task, older, deleted, assignmentNotice],
    });

    const { newNotes, notesByTaskId, tasksById } = await getRecentTaskNotes(oystehr as unknown as Oystehr, windowStart);

    expect(oystehr.fhir.search.mock.calls[0][0].params).toEqual(
      expect.arrayContaining([
        { name: '_tag', value: TASK_NOTE_TAG },
        { name: 'status', value: 'completed' },
        { name: 'sent', value: `ge${windowStart.toISO()}` },
        { name: '_include', value: 'Communication:based-on' },
        { name: '_revinclude:iterate', value: 'Communication:based-on' },
      ])
    );
    expect(newNotes.map((n) => n.id)).toEqual(['fresh']);
    expect(notesByTaskId.get(task.id!)?.map((n) => n.id)).toEqual(['fresh', 'notified', 'older']);
    expect(tasksById.get(task.id!)).toBe(task);
  });
});

describe('notifications-updater: new task notes', () => {
  beforeEach(() => {
    const staff = [
      migratedStaff('assignee'),
      legacyPhoneStaff('creator'),
      migratedStaff('earlier'),
      migratedStaff('writer'),
      migratedStaff('ghost'),
      migratedStaff('bystander', { assignedTo: 'anyone' }),
    ];
    vi.mocked(getEmployees).mockResolvedValue(
      staff.map((practitioner) => ({
        id: `user-${practitioner.id}`,
        profile: `Practitioner/${practitioner.id}`,
      })) as never
    );
    vi.mocked(getRoles).mockResolvedValue([
      { id: 'inactive-role', name: RoleType.Inactive },
      { id: 'provider-role', name: RoleType.Provider },
    ] as never);
    vi.mocked(getRoleMembers).mockResolvedValue([]);
    searchResults.set('Practitioner', { matches: staff });
    searchResults.set('Communication', {
      matches: [note('first', 'writer', readBy('earlier')), note('second', 'writer', readBy('earlier'))],
      includes: [
        task,
        note('older', 'earlier', {
          sent: DateTime.utc().minus({ days: 3 }).toISO()!,
          meta: {
            tag: [
              { system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE },
              { system: TASK_NOTE_NOTIFIED_TAG_SYSTEM, code: TASK_NOTE_NOTIFIED_TAG_CODE },
            ],
          },
        }),
        note('deleted', 'ghost', { status: 'entered-in-error' }),
      ],
    });
  });

  it("notifies each other involved person once per run per their settings, without the note's text", async () => {
    await notificationsUpdater({ headers: {}, body: '{}', secrets: {} });

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    const notifications = requests.filter((request: { method: string }) => request.method === 'POST');
    // The assignee's bell, once for both notes; the creator is phone-only, so they get a text and no bell entry.
    expect(notifications).toHaveLength(1);
    expect(notifications[0].resource).toMatchObject({
      category: [
        {
          coding: expect.arrayContaining([
            { system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: AppointmentProviderNotificationTypes.task_note_added },
          ]),
        },
      ],
      status: 'in-progress',
      basedOn: [{ reference: 'Task/task-1' }],
      recipient: [{ reference: 'Practitioner/assignee' }],
      payload: [{ contentString: `New note on task: ${TASK_TITLE}` }],
    });
    expect(oystehr.transactionalSMS.send).toHaveBeenCalledTimes(1);
    expect(oystehr.transactionalSMS.send).toHaveBeenCalledWith({
      resource: 'Practitioner/creator',
      message: `New note on task: ${TASK_TITLE}`,
    });
    expect(JSON.stringify(requests)).not.toContain('Private details');
  });

  it('stamps each new note as notified in the same transaction, so the next run skips it', async () => {
    await notificationsUpdater({ headers: {}, body: '{}', secrets: {} });

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    const notePatches = requests.filter((request: { method: string }) => request.method === 'PATCH');
    expect(notePatches.map((request: { url: string }) => request.url)).toEqual([
      '/Communication/first',
      '/Communication/second',
    ]);
    for (const patch of notePatches) {
      expect(decodePatch(patch.resource.data)).toEqual([
        {
          op: 'add',
          path: '/meta/tag/-',
          value: { system: TASK_NOTE_NOTIFIED_TAG_SYSTEM, code: TASK_NOTE_NOTIFIED_TAG_CODE },
        },
      ]);
    }
  });
});
