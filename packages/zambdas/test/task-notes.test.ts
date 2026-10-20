import type { APIGatewayProxyResult } from 'aws-lambda';
import type { Communication, Practitioner } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRequestParameters as validateCreate } from '../src/ehr/patient-notes/create/validateRequestParameters';
import { GetPatientNotesSchema } from '../src/ehr/patient-notes/get/index';
import {
  NOTE_EDITOR_EXTENSION_URL,
  PATIENT_NOTE_TAG,
  TASK_NOTE_READ_BY_TAG_SYSTEM,
  TASK_NOTE_TAG,
  toNoteDto,
} from '../src/shared/notes';
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
  fhir: { get: vi.fn(), search: vi.fn(), create: vi.fn(), update: vi.fn(), patch: vi.fn(), transaction: vi.fn() },
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
const { index: deleteHandler } = (await import('../src/ehr/patient-notes/delete/index')) as unknown as {
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

  it('stays unread for the caller when only someone else has read it, and patient notes are never unread', () => {
    expect(toNoteDto(taskNote(readBy('practitioner-third')), ME).isUnread).toBe(true);
    const [system, code] = PATIENT_NOTE_TAG.split('|');
    expect(toNoteDto(taskNote({ meta: { tag: [{ system, code }] } }), ME).isUnread).toBe(false);
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

  it('get: needs a signed-in caller to work out what is unread', async () => {
    await expect(getHandler({ ...makeInput({ taskIds: [TASK_ID] }), headers: {} })).rejects.toBe(NOT_AUTHORIZED);
    expect(getAllFhirSearchPages).not.toHaveBeenCalled();
  });

  it('create: files a task note under its task and on no patient record', async () => {
    mockFhirClient.fhir.get.mockResolvedValue(me);
    mockFhirClient.fhir.create.mockImplementation((resource: Communication) => ({ ...resource, id: NOTE_ID }));

    const result = await createHandler(makeInput({ note: { taskId: TASK_ID, text: 'Left a voicemail' } }));

    const created: Communication = mockFhirClient.fhir.create.mock.calls[0][0];
    expect(created).toMatchObject({
      status: 'completed',
      basedOn: [{ reference: `Task/${TASK_ID}` }],
      meta: { tag: [{ system: TASK_NOTE_SYSTEM, code: TASK_NOTE_CODE }] },
      sender: { reference: `Practitioner/${ME}`, display: 'Jane Smith' },
      payload: [{ contentString: 'Left a voicemail' }],
    });
    expect(created.subject).toBeUndefined();
    expect(JSON.parse(result.body).note).toMatchObject({ taskId: TASK_ID, authorId: ME, isUnread: false });
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

  it('update: rejects a task note sent with another task id, or as a patient note', async () => {
    mockFhirClient.fhir.get.mockResolvedValue(taskNote());

    await expect(
      updateHandler(
        makeInput({ note: { resourceId: NOTE_ID, taskId: '880e8400-e29b-41d4-a716-446655440003', text: 'x' } })
      )
    ).rejects.toMatchObject({ code: 4103 });
    await expect(
      updateHandler(makeInput({ note: { resourceId: NOTE_ID, patientId: PATIENT_ID, text: 'x' } }))
    ).rejects.toMatchObject({ code: 4103 });
    expect(mockFhirClient.fhir.patch).not.toHaveBeenCalled();
  });

  it('delete: removes a task note by marking it entered-in-error', async () => {
    mockFhirClient.fhir.get.mockResolvedValue(taskNote());

    await deleteHandler(makeInput({ resourceId: NOTE_ID }));

    expect(mockFhirClient.fhir.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: NOTE_ID, status: 'entered-in-error' })
    );
  });

  it("mark-read: appends the caller's read tag to only the notes they hadn't read", async () => {
    vi.mocked(getAllFhirSearchPages).mockResolvedValue([
      taskNote({ id: 'unread' }),
      taskNote({ ...readBy(ME), id: 'read' }),
      taskNote({ id: 'mine', sender: { reference: `Practitioner/${ME}` } }),
    ]);

    const result = await markReadHandler(makeInput({ taskId: TASK_ID }));

    expect(vi.mocked(getAllFhirSearchPages).mock.calls[0][0].params).toEqual(
      expect.arrayContaining([
        { name: 'based-on', value: `Task/${TASK_ID}` },
        { name: '_tag', value: TASK_NOTE_TAG },
        { name: 'status', value: 'completed' },
      ])
    );
    expect(JSON.parse(result.body).marked).toBe(1);
    const { requests } = mockFhirClient.fhir.transaction.mock.calls[0][0];
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('/Communication/unread');
    // Appended, never a replace of /meta/tag, so other readers' tags written meanwhile survive.
    expect(JSON.parse(atob(requests[0].resource.data))).toEqual([
      { op: 'add', path: '/meta/tag/-', value: { system: TASK_NOTE_READ_BY_TAG_SYSTEM, code: ME } },
    ]);
  });

  it('mark-read: writes nothing when the caller has already read every note', async () => {
    vi.mocked(getAllFhirSearchPages).mockResolvedValue([taskNote(readBy(ME))]);

    const result = await markReadHandler(makeInput({ taskId: TASK_ID }));

    expect(JSON.parse(result.body).marked).toBe(0);
    expect(mockFhirClient.fhir.transaction).not.toHaveBeenCalled();
  });
});
