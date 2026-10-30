import Oystehr, { BatchInput, FhirResource, FhirSearchParams } from '@oystehr/sdk';
import type { APIGatewayProxyResult } from 'aws-lambda';
import { applyPatch, Operation } from 'fast-json-patch';
import { Communication, Practitioner, Task } from 'fhir/r4b';
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

const store = new Map<string, FhirResource>();
const put = (...resources: FhirResource[]): void => {
  for (const resource of resources) store.set(`${resource.resourceType}/${resource.id}`, resource);
};
const stored = <T extends FhirResource>(resourceType: T['resourceType']): T[] =>
  [...store.values()].filter((resource): resource is T => resource.resourceType === resourceType);

const bundle = (matches: FhirResource[], includes: FhirResource[] = []): object => ({
  total: matches.length,
  entry: [
    ...matches.map((resource) => ({ resource, search: { mode: 'match' } })),
    ...includes.map((resource) => ({ resource, search: { mode: 'include' } })),
  ],
  unbundle: () => [...matches, ...includes],
});

const searchTaskNotes = ({ params = [] }: FhirSearchParams<FhirResource>): object => {
  const value = (name: string): string => String(params.find((param) => param.name === name)?.value);
  const [tagSystem, tagCode] = value('_tag').split('|');
  const [excludedSystem, excludedCode] = value('_tag:not').split('|');
  const sentFrom = DateTime.fromISO(value('sent').replace(/^ge/, ''));
  const matches = stored<Communication>('Communication').filter(
    (communication) =>
      communication.status === value('status') &&
      communication.meta?.tag?.some((tag) => tag.system === tagSystem && tag.code === tagCode) &&
      !communication.meta?.tag?.some((tag) => tag.system === excludedSystem && tag.code === excludedCode) &&
      DateTime.fromISO(communication.sent ?? '') >= sentFrom
  );
  const taskReferences = new Set(matches.flatMap((match) => match.basedOn?.map((basedOn) => basedOn.reference)));
  const tasks = stored<Task>('Task').filter((task) => taskReferences.has(`Task/${task.id}`));
  const others = stored<Communication>('Communication').filter(
    (communication) =>
      !matches.includes(communication) &&
      communication.basedOn?.some((basedOn) => taskReferences.has(basedOn.reference))
  );
  return bundle(matches, [...tasks, ...others]);
};

const oystehr = {
  fhir: {
    search: vi.fn(async (params: FhirSearchParams<FhirResource>) => {
      if (params.resourceType === 'Communication') return searchTaskNotes(params);
      if (params.resourceType === 'Practitioner') return bundle(stored<Practitioner>('Practitioner'));
      return bundle([]);
    }),
    transaction: vi.fn(async ({ requests }: BatchInput<FhirResource>) => {
      for (const request of requests) {
        if (!('resource' in request)) continue;
        if (request.method === 'POST') put({ ...request.resource, id: `created-${store.size}` });
        if (request.method === 'PATCH' && request.resource.resourceType === 'Binary') {
          const key = request.url.replace(/^\//, '');
          const target = store.get(key);
          if (!target) throw new Error(`${key} is not stored`);
          const operations: Operation[] = JSON.parse(atob(request.resource.data ?? ''));
          store.set(key, applyPatch(structuredClone(target), operations).newDocument);
        }
      }
      return {};
    }),
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

const notifiedTag = { system: TASK_NOTE_NOTIFIED_TAG_SYSTEM, code: TASK_NOTE_NOTIFIED_TAG_CODE };

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
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
      meta: { tag: [{ system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE }, notifiedTag] },
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
    put(fresh, notified, older, deleted, assignmentNotice, task);

    const { newNotes, notesByTaskId, tasksById } = await getRecentTaskNotes(oystehr as unknown as Oystehr, windowStart);

    expect(oystehr.fhir.search.mock.calls[0][0].params).toEqual(
      expect.arrayContaining([
        { name: '_tag', value: TASK_NOTE_TAG },
        { name: '_tag:not', value: `${TASK_NOTE_NOTIFIED_TAG_SYSTEM}|${TASK_NOTE_NOTIFIED_TAG_CODE}` },
        { name: 'status', value: 'completed' },
        { name: 'sent', value: `ge${windowStart.toISO()}` },
        { name: '_include', value: 'Communication:based-on' },
        { name: '_revinclude:iterate', value: 'Communication:based-on' },
      ])
    );
    expect(newNotes.map((n) => n.id)).toEqual(['fresh']);
    expect(notesByTaskId.get(task.id!)?.map((n) => n.id)).toEqual(['fresh', 'notified', 'older']);
    expect(tasksById.get(task.id!)).toEqual(task);
  });

  it('does not reload a processed discussion when no new notes remain', async () => {
    put(
      task,
      note('notified', 'writer', { meta: { tag: [{ system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE }, notifiedTag] } }),
      note('older', 'earlier', { sent: DateTime.utc().minus({ days: 3 }).toISO()! })
    );

    const { newNotes, notesByTaskId, tasksById } = await getRecentTaskNotes(oystehr as unknown as Oystehr, windowStart);

    expect(newNotes).toEqual([]);
    expect(notesByTaskId.size).toBe(0);
    expect(tasksById.size).toBe(0);
  });
});

describe('notifications-updater: new task notes', () => {
  const run = (): Promise<APIGatewayProxyResult> => notificationsUpdater({ headers: {}, body: '{}', secrets: {} });
  const bellNotifications = (): Communication[] =>
    stored<Communication>('Communication').filter((communication) => communication.recipient);

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
    put(
      ...staff,
      task,
      note('first', 'writer', readBy('earlier')),
      note('second', 'writer', readBy('earlier')),
      note('older', 'earlier', {
        sent: DateTime.utc().minus({ days: 3 }).toISO()!,
        meta: { tag: [{ system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE }, notifiedTag] },
      }),
      note('deleted', 'ghost', { status: 'entered-in-error' })
    );
  });

  it("notifies each other involved person once per run per their settings, without the note's text", async () => {
    await run();

    expect(bellNotifications()).toHaveLength(1);
    expect(bellNotifications()[0]).toMatchObject({
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
    expect(JSON.stringify(oystehr.fhir.transaction.mock.calls)).not.toContain('Private details');
  });

  it('notifies nobody again on the next run, but does tell them about a note written since', async () => {
    await run();
    await run();

    expect(bellNotifications()).toHaveLength(1);
    expect(oystehr.transactionalSMS.send).toHaveBeenCalledTimes(1);
    expect(store.get('Communication/first')?.meta?.tag).toEqual([...(readBy('earlier').meta?.tag ?? []), notifiedTag]);

    put(note('third', 'earlier'));
    await run();

    expect(bellNotifications().map((notification) => notification.recipient?.[0].reference)).toEqual([
      'Practitioner/assignee',
      'Practitioner/assignee',
      'Practitioner/writer',
    ]);
    expect(oystehr.transactionalSMS.send).toHaveBeenCalledTimes(2);
  });
});
