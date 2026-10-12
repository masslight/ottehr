import type { APIGatewayProxyResult } from 'aws-lambda';
import type { Communication, Practitioner, Task } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  PROVIDER_NOTIFICATION_PREFERENCES_V2_URL,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
} from 'utils/lib/types/api/practitioner.types';
import type { ProviderNotificationPreferencesV2 } from 'utils/lib/types/api/provider-notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTaskNoteDelivery, resolveTaskNoteRecipientIds } from '../src/cron/notifications-updater/index';
import { validateRequestParameters as validateCreate } from '../src/ehr/patient-notes/create/validateRequestParameters';
import { GetPatientNotesSchema } from '../src/ehr/patient-notes/get/index';
import { NOTE_EDITOR_EXTENSION_URL, TASK_NOTE_READ_BY_TAG_SYSTEM, TASK_NOTE_TAG, toNoteDto } from '../src/shared/notes';
import { getMyPractitionerId } from '../src/shared/practitioners';
import type { ZambdaInput } from '../src/shared/types/common';
import { validateWithSchema } from '../src/shared/validation';

vi.mock('../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-m2m-token') };
});

vi.mock('../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createClinicalOystehrClient: vi.fn(() => mockFhirClient) };
});

vi.mock('../src/shared/sentry', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn };
});

vi.mock('../src/shared/practitioners', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getMyPractitionerId: vi.fn() };
});

vi.mock('utils/lib/fhir/getAllFhirSearchPages', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getAllFhirSearchPages: vi.fn() };
});

const mockFhirClient = {
  fhir: { get: vi.fn(), search: vi.fn(), create: vi.fn(), patch: vi.fn(), transaction: vi.fn() },
};

type Handler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
const { index: getHandler } = (await import('../src/ehr/patient-notes/get/index')) as unknown as { index: Handler };
const { index: createHandler } = (await import('../src/ehr/patient-notes/create/index')) as unknown as {
  index: Handler;
};
const { index: updateHandler } = (await import('../src/ehr/patient-notes/update/index')) as unknown as {
  index: Handler;
};
const { index: markReadHandler } = (await import('../src/ehr/patient-notes/mark-read/index')) as unknown as {
  index: Handler;
};

const TASK_ID = '770e8400-e29b-41d4-a716-446655440002';
const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const NOTE_ID = '660e8400-e29b-41d4-a716-446655440001';
const ME = 'practitioner-me';
const OTHER = 'practitioner-other';
const [TASK_NOTE_SYSTEM, TASK_NOTE_CODE] = TASK_NOTE_TAG.split('|');

const makeInput = (body: Record<string, unknown>): ZambdaInput => ({
  headers: { Authorization: 'Bearer user-token' },
  body: JSON.stringify(body),
  secrets: {},
});

const me: Practitioner = { resourceType: 'Practitioner', id: ME, name: [{ given: ['Jane'], family: 'Smith' }] };

const taskNote = (overrides: Partial<Communication> = {}): Communication => ({
  resourceType: 'Communication',
  id: NOTE_ID,
  status: 'completed',
  meta: { tag: [{ system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE }], lastUpdated: '2026-01-01T13:00:00.000Z' },
  basedOn: [{ reference: `Task/${TASK_ID}` }],
  subject: { reference: `Patient/${PATIENT_ID}` },
  sender: { reference: `Practitioner/${OTHER}`, display: 'Lina Grace' },
  sent: '2026-01-01T12:00:00.000Z',
  payload: [{ contentString: 'Called the patient' }],
  ...overrides,
});

const readBy = (practitionerId: string): Partial<Communication> => ({
  meta: {
    tag: [
      { system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE },
      { system: TASK_NOTE_READ_BY_TAG_SYSTEM, code: practitionerId },
    ],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMyPractitionerId).mockResolvedValue(ME);
});

describe('task note validation', () => {
  it('accepts a task note and rejects a note with both or neither target', () => {
    expect(validateCreate(makeInput({ note: { taskId: TASK_ID, text: 'hi' } })).note.taskId).toBe(TASK_ID);
    expect(() => validateCreate(makeInput({ note: { taskId: TASK_ID, patientId: PATIENT_ID, text: 'hi' } }))).toThrow();
    expect(() => validateCreate(makeInput({ note: { text: 'hi' } }))).toThrow();
  });

  it('accepts taskIds for get, and not together with patientId', () => {
    expect(validateWithSchema(GetPatientNotesSchema, makeInput({ taskIds: [TASK_ID] })).taskIds).toEqual([TASK_ID]);
    expect(() =>
      validateWithSchema(GetPatientNotesSchema, makeInput({ taskIds: [TASK_ID], patientId: PATIENT_ID }))
    ).toThrow();
  });
});

describe('toNoteDto', () => {
  it('lists editors other than the author and keeps the author', () => {
    const dto = toNoteDto(
      taskNote({
        extension: [
          {
            url: NOTE_EDITOR_EXTENSION_URL,
            valueReference: { reference: `Practitioner/${OTHER}`, display: 'Lina Grace' },
          },
          {
            url: NOTE_EDITOR_EXTENSION_URL,
            valueReference: { reference: `Practitioner/${ME}`, display: 'Jane Smith' },
          },
        ],
      })
    );
    expect(dto).toMatchObject({ authorName: 'Lina Grace', editorNames: ['Jane Smith'], edited: true, taskId: TASK_ID });
  });

  it('marks a task note edited only from its editor list, not from lastUpdated drift', () => {
    expect(toNoteDto(taskNote()).edited).toBe(false);
  });

  it('is unread only when someone else wrote it and the caller has no read tag', () => {
    expect(toNoteDto(taskNote(), ME).isUnread).toBe(true);
    expect(toNoteDto(taskNote(readBy(ME)), ME).isUnread).toBe(false);
    expect(toNoteDto(taskNote({ sender: { reference: `Practitioner/${ME}` } }), ME).isUnread).toBe(false);
  });
});

describe('task notes handlers', () => {
  it('get: returns every note on the tasks with unread flags for the caller', async () => {
    vi.mocked(getAllFhirSearchPages).mockResolvedValue([taskNote(), taskNote({ ...readBy(ME), id: 'second' })]);

    const result = await getHandler(makeInput({ taskIds: [TASK_ID] }));

    const params = vi.mocked(getAllFhirSearchPages).mock.calls[0][0].params;
    expect(params).toEqual(
      expect.arrayContaining([
        { name: 'based-on', value: `Task/${TASK_ID}` },
        { name: '_tag', value: TASK_NOTE_TAG },
        { name: '_sort', value: '-sent' },
      ])
    );
    const body = JSON.parse(result.body);
    expect(body.hasMore).toBe(false);
    expect(body.notes.map((note: { isUnread: boolean }) => note.isUnread)).toEqual([true, false]);
  });

  it('create: files a task note under its task', async () => {
    mockFhirClient.fhir.get.mockResolvedValue(me);
    mockFhirClient.fhir.create.mockImplementation((resource: Communication) => ({ ...resource, id: NOTE_ID }));

    await createHandler(makeInput({ note: { taskId: TASK_ID, text: 'Left a voicemail' } }));

    expect(mockFhirClient.fhir.create).toHaveBeenCalledWith(
      expect.objectContaining({
        basedOn: [{ reference: `Task/${TASK_ID}` }],
        meta: { tag: [{ system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE }] },
        sender: { reference: `Practitioner/${ME}`, display: 'Jane Smith' },
      })
    );
  });

  it('update: patches only the text and editor list, so the author and tags stay', async () => {
    mockFhirClient.fhir.get.mockImplementation(({ resourceType }) =>
      resourceType === 'Communication' ? taskNote(readBy(OTHER)) : me
    );
    mockFhirClient.fhir.patch.mockImplementation(() => taskNote());

    await updateHandler(makeInput({ note: { resourceId: NOTE_ID, taskId: TASK_ID, text: 'Edited' } }));

    const { operations } = mockFhirClient.fhir.patch.mock.calls[0][0];
    expect(operations).toEqual([
      { op: 'replace', path: '/payload', value: [{ contentString: 'Edited' }] },
      {
        op: 'add',
        path: '/extension',
        value: [
          {
            url: NOTE_EDITOR_EXTENSION_URL,
            valueReference: { reference: `Practitioner/${ME}`, display: 'Jane Smith' },
          },
        ],
      },
    ]);
  });

  it('update: rejects a task note sent with another task id', async () => {
    mockFhirClient.fhir.get.mockResolvedValue(taskNote());

    await expect(
      updateHandler(
        makeInput({ note: { resourceId: NOTE_ID, taskId: '880e8400-e29b-41d4-a716-446655440003', text: 'x' } })
      )
    ).rejects.toMatchObject({ code: 4103 });
  });

  it("mark-read: tags only the notes the caller hadn't read", async () => {
    vi.mocked(getAllFhirSearchPages).mockResolvedValue([
      taskNote({ id: 'unread' }),
      taskNote({ ...readBy(ME), id: 'read' }),
      taskNote({ id: 'mine', sender: { reference: `Practitioner/${ME}` } }),
    ]);

    const result = await markReadHandler(makeInput({ taskId: TASK_ID }));

    expect(JSON.parse(result.body).marked).toBe(1);
    const { requests } = mockFhirClient.fhir.transaction.mock.calls[0][0];
    expect(requests.map((request: { url: string }) => request.url)).toEqual(['/Communication/unread']);
  });
});

describe('resolveTaskNoteDelivery', () => {
  const row = { enabled: true, method: undefined, locationIds: ['loc-1'], allLocations: false, assignedTo: 'me' };
  const withPrefs: Practitioner = {
    resourceType: 'Practitioner',
    extension: [
      {
        url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
        extension: [{ url: PROVIDER_NOTIFICATION_PREFERENCES_V2_URL, valueString: '{}' }],
      },
    ],
  };

  it("follows the category row's on/off and locations, even on an unassigned task", () => {
    const prefs = { taskCategories: { patientFollowUp: row } } as unknown as ProviderNotificationPreferencesV2;
    expect(resolveTaskNoteDelivery(withPrefs, prefs, 'patientFollowUp', 'loc-1').notify).toBe(true);
    expect(resolveTaskNoteDelivery(withPrefs, prefs, 'patientFollowUp', 'loc-2').notify).toBe(false);
    const off = { taskCategories: { patientFollowUp: { ...row, enabled: false } } };
    expect(
      resolveTaskNoteDelivery(
        withPrefs,
        off as unknown as ProviderNotificationPreferencesV2,
        'patientFollowUp',
        'loc-1'
      ).notify
    ).toBe(false);
  });
});

describe('resolveTaskNoteRecipientIds', () => {
  it("notifies the assignee, creator and note authors, but not the new note's author", () => {
    const task: Task = {
      resourceType: 'Task',
      status: 'ready',
      intent: 'order',
      owner: { reference: 'Practitioner/assignee' },
      requester: { reference: 'Practitioner/creator' },
    };
    const note = taskNote({ sender: { reference: 'Practitioner/writer' } });
    const earlier = taskNote({ sender: { reference: 'Practitioner/earlier' } });

    expect(resolveTaskNoteRecipientIds(task, [earlier, note], note).sort()).toEqual(['assignee', 'creator', 'earlier']);
  });
});
