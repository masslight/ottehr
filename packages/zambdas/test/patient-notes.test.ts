import type { APIGatewayProxyResult } from 'aws-lambda';
import type { Communication, Practitioner } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRequestParameters as validateDelete } from '../src/ehr/patient-notes/delete/validateRequestParameters';
import { validateRequestParameters as validateGet } from '../src/ehr/patient-notes/get/validateRequestParameters';
import { validateRequestParameters as validateSave } from '../src/ehr/patient-notes/save/validateRequestParameters';
import { getMyPractitionerId } from '../src/shared/practitioners';
import type { ZambdaInput } from '../src/shared/types/common';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mock FHIR client — individual methods overridden per test
// ---------------------------------------------------------------------------

const mockFhirClient = {
  fhir: {
    get: vi.fn(),
    search: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

// ---------------------------------------------------------------------------
// Handler imports — must come after vi.mock() so hoisting applies
// ---------------------------------------------------------------------------

const { index: getHandler } = (await import('../src/ehr/patient-notes/get/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

const { index: saveHandler } = (await import('../src/ehr/patient-notes/save/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

const { index: deleteHandler } = (await import('../src/ehr/patient-notes/delete/index')) as unknown as {
  index: (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_PATIENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_NOTE_ID = '660e8400-e29b-41d4-a716-446655440001';
const CALLER_ID = 'practitioner-caller-id';
const OTHER_ID = 'practitioner-other-id';
const PATIENT_NOTE_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/patient`;
const PATIENT_NOTE_TAG = `${PATIENT_NOTE_SYSTEM}|patient-note`;

function makeInput(body: Record<string, unknown> | null, authToken?: string): ZambdaInput {
  return {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : null,
    body: body !== null ? JSON.stringify(body) : null,
    secrets: null,
  };
}

const baseNotePayload = {
  patientId: VALID_PATIENT_ID,
  text: 'Test note content',
};

const fakePractitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: CALLER_ID,
  name: [{ given: ['Jane'], family: 'Smith' }],
};

function fakeNote(overrides: Partial<Communication> = {}): Communication {
  return {
    resourceType: 'Communication',
    id: VALID_NOTE_ID,
    status: 'completed',
    meta: {
      tag: [{ system: PATIENT_NOTE_SYSTEM, code: 'patient-note' }],
      lastUpdated: '2026-01-01T12:00:10.000Z',
    },
    subject: { reference: `Patient/${VALID_PATIENT_ID}` },
    sender: { reference: `Practitioner/${CALLER_ID}`, display: 'Jane Smith' },
    sent: '2026-01-01T12:00:00.000Z',
    payload: [{ contentString: 'Test note content' }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// get/validateRequestParameters
// ---------------------------------------------------------------------------

describe('get-patient-notes validateRequestParameters', () => {
  it('parses a valid patientId', () => {
    const result = validateGet(makeInput({ patientId: VALID_PATIENT_ID }));
    expect(result.patientId).toBe(VALID_PATIENT_ID);
  });

  it('throws when body is missing', () => {
    expect(() => validateGet(makeInput(null))).toThrow();
  });

  it('throws when patientId is not a UUID', () => {
    expect(() => validateGet(makeInput({ patientId: 'not-a-uuid' }))).toThrow(/uuid/i);
  });

  it('throws when patientId is absent', () => {
    expect(() => validateGet(makeInput({}))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// save/validateRequestParameters
// ---------------------------------------------------------------------------

describe('save-patient-note validateRequestParameters', () => {
  it('parses a valid note with Authorization header', () => {
    const result = validateSave(makeInput({ note: baseNotePayload }, 'my-token'));
    expect(result.note.patientId).toBe(VALID_PATIENT_ID);
    expect(result.note.text).toBe('Test note content');
    expect(result.userToken).toBe('my-token');
  });

  it('throws when Authorization header is missing', () => {
    expect(() => validateSave(makeInput({ note: baseNotePayload }))).toThrow(/Authorization/i);
  });

  it('throws when body is missing', () => {
    expect(() => validateSave({ headers: { Authorization: 'Bearer tok' }, body: null, secrets: null })).toThrow();
  });

  it('throws when note text is empty', () => {
    expect(() => validateSave(makeInput({ note: { ...baseNotePayload, text: '' } }, 'tok'))).toThrow();
  });

  it('throws when patientId is not a UUID', () => {
    expect(() => validateSave(makeInput({ note: { ...baseNotePayload, patientId: 'not-a-uuid' } }, 'tok'))).toThrow(
      /uuid/i
    );
  });
});

// ---------------------------------------------------------------------------
// delete/validateRequestParameters
// ---------------------------------------------------------------------------

describe('delete-patient-note validateRequestParameters', () => {
  it('parses a valid resourceId with Authorization header', () => {
    const result = validateDelete(makeInput({ resourceId: VALID_NOTE_ID }, 'my-token'));
    expect(result.resourceId).toBe(VALID_NOTE_ID);
    expect(result.userToken).toBe('my-token');
  });

  it('throws when Authorization header is missing', () => {
    expect(() => validateDelete(makeInput({ resourceId: VALID_NOTE_ID }))).toThrow(/Authorization/i);
  });

  it('throws when body is missing', () => {
    expect(() => validateDelete({ headers: { Authorization: 'Bearer tok' }, body: null, secrets: null })).toThrow();
  });

  it('throws when resourceId is not a UUID', () => {
    expect(() => validateDelete(makeInput({ resourceId: 'not-a-uuid' }, 'tok'))).toThrow(/uuid/i);
  });

  it('throws when resourceId is absent', () => {
    expect(() => validateDelete(makeInput({}, 'tok'))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// get-patient-notes handler
// ---------------------------------------------------------------------------

describe('get-patient-notes handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with correctly mapped notes', async () => {
    mockFhirClient.fhir.search.mockResolvedValue({ unbundle: () => [fakeNote()] });

    const result = await getHandler(makeInput({ patientId: VALID_PATIENT_ID }));

    expect(result.statusCode).toBe(200);
    const { notes } = JSON.parse(result.body);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      resourceId: VALID_NOTE_ID,
      patientId: VALID_PATIENT_ID,
      text: 'Test note content',
      authorId: CALLER_ID,
      authorName: 'Jane Smith',
    });
  });

  it('returns 200 with empty array when no notes exist', async () => {
    mockFhirClient.fhir.search.mockResolvedValue({ unbundle: () => [] });

    const result = await getHandler(makeInput({ patientId: VALID_PATIENT_ID }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).notes).toHaveLength(0);
  });

  it('searches with the correct subject, tag, and sort params', async () => {
    mockFhirClient.fhir.search.mockResolvedValue({ unbundle: () => [] });

    await getHandler(makeInput({ patientId: VALID_PATIENT_ID }));

    const [call] = mockFhirClient.fhir.search.mock.calls;
    expect(call[0].resourceType).toBe('Communication');
    expect(call[0].params).toEqual(
      expect.arrayContaining([
        { name: 'subject', value: `Patient/${VALID_PATIENT_ID}` },
        { name: '_tag', value: PATIENT_NOTE_TAG },
        { name: 'status', value: 'completed' },
        { name: '_sort', value: '-_lastUpdated' },
      ])
    );
  });

  it('marks note as edited when lastUpdated is more than 5 s after sent', async () => {
    const editedNote = fakeNote({
      sent: '2026-01-01T12:00:00.000Z',
      meta: {
        tag: [{ system: PATIENT_NOTE_SYSTEM, code: 'patient-note' }],
        lastUpdated: '2026-01-01T12:00:10.000Z', // 10 s later
      },
    });
    mockFhirClient.fhir.search.mockResolvedValue({ unbundle: () => [editedNote] });

    const result = await getHandler(makeInput({ patientId: VALID_PATIENT_ID }));
    const { notes } = JSON.parse(result.body);
    expect(notes[0].edited).toBe(true);
  });

  it('does not mark note as edited when lastUpdated is within 5 s of sent', async () => {
    const freshNote = fakeNote({
      sent: '2026-01-01T12:00:00.000Z',
      meta: {
        tag: [{ system: PATIENT_NOTE_SYSTEM, code: 'patient-note' }],
        lastUpdated: '2026-01-01T12:00:03.000Z', // 3 s later — within window
      },
    });
    mockFhirClient.fhir.search.mockResolvedValue({ unbundle: () => [freshNote] });

    const result = await getHandler(makeInput({ patientId: VALID_PATIENT_ID }));
    const { notes } = JSON.parse(result.body);
    expect(notes[0].edited).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// save-patient-note handler
// ---------------------------------------------------------------------------

describe('save-patient-note handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMyPractitionerId).mockResolvedValue(CALLER_ID);
  });

  it('creates a new Communication when no resourceId is supplied', async () => {
    const saved = fakeNote();
    mockFhirClient.fhir.get.mockResolvedValue(fakePractitioner);
    mockFhirClient.fhir.create.mockResolvedValue(saved);

    const result = await saveHandler(makeInput({ note: baseNotePayload }, 'user-token'));

    expect(result.statusCode).toBe(200);
    expect(mockFhirClient.fhir.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Communication',
        sender: { reference: `Practitioner/${CALLER_ID}`, display: 'Jane Smith' },
        subject: { reference: `Patient/${VALID_PATIENT_ID}` },
      })
    );
    expect(mockFhirClient.fhir.update).not.toHaveBeenCalled();
  });

  it('updates the Communication when resourceId is supplied and caller owns the note', async () => {
    const existing = fakeNote();
    const updated = fakeNote({ payload: [{ contentString: 'updated text' }] });
    mockFhirClient.fhir.get.mockResolvedValueOnce(fakePractitioner).mockResolvedValueOnce(existing);
    mockFhirClient.fhir.update.mockResolvedValue(updated);

    const result = await saveHandler(
      makeInput({ note: { ...baseNotePayload, resourceId: VALID_NOTE_ID, text: 'updated text' } }, 'user-token')
    );

    expect(result.statusCode).toBe(200);
    expect(mockFhirClient.fhir.update).toHaveBeenCalledWith(expect.objectContaining({ id: VALID_NOTE_ID }));
    expect(mockFhirClient.fhir.create).not.toHaveBeenCalled();
  });

  it('throws when the existing resource lacks the patient-note tag on update', async () => {
    const untagged = fakeNote({ meta: { tag: [{ system: 'other-system', code: 'other-code' }] } });
    mockFhirClient.fhir.get.mockResolvedValueOnce(fakePractitioner).mockResolvedValueOnce(untagged);

    await expect(
      saveHandler(makeInput({ note: { ...baseNotePayload, resourceId: VALID_NOTE_ID } }, 'user-token'))
    ).rejects.toThrow(/not a patient note/i);

    expect(mockFhirClient.fhir.update).not.toHaveBeenCalled();
  });

  it('throws when the note subject does not match the requested patientId on update', async () => {
    const differentPatient = fakeNote({ subject: { reference: 'Patient/different-patient-id' } });
    mockFhirClient.fhir.get.mockResolvedValueOnce(fakePractitioner).mockResolvedValueOnce(differentPatient);

    await expect(
      saveHandler(makeInput({ note: { ...baseNotePayload, resourceId: VALID_NOTE_ID } }, 'user-token'))
    ).rejects.toThrow(/does not belong/i);

    expect(mockFhirClient.fhir.update).not.toHaveBeenCalled();
  });

  it('throws when caller is not the original author on update', async () => {
    const ownedByOther = fakeNote({ sender: { reference: `Practitioner/${OTHER_ID}` } });
    mockFhirClient.fhir.get.mockResolvedValueOnce(fakePractitioner).mockResolvedValueOnce(ownedByOther);

    await expect(
      saveHandler(makeInput({ note: { ...baseNotePayload, resourceId: VALID_NOTE_ID } }, 'user-token'))
    ).rejects.toThrow(/not authorized/i);

    expect(mockFhirClient.fhir.update).not.toHaveBeenCalled();
  });

  it('sets sender.display from the FHIR Practitioner resource name', async () => {
    mockFhirClient.fhir.get.mockResolvedValue(fakePractitioner);
    mockFhirClient.fhir.create.mockResolvedValue(fakeNote());

    await saveHandler(makeInput({ note: baseNotePayload }, 'user-token'));

    const created = mockFhirClient.fhir.create.mock.calls[0][0] as Communication;
    expect(created.sender?.display).toBe('Jane Smith');
  });

  it('sets sender.reference from the token identity, not the request body', async () => {
    mockFhirClient.fhir.get.mockResolvedValue(fakePractitioner);
    mockFhirClient.fhir.create.mockResolvedValue(fakeNote());

    await saveHandler(makeInput({ note: baseNotePayload }, 'user-token'));

    expect(getMyPractitionerId).toHaveBeenCalledWith('user-token', null);
    const created = mockFhirClient.fhir.create.mock.calls[0][0] as Communication;
    expect(created.sender?.reference).toBe(`Practitioner/${CALLER_ID}`);
  });

  it('preserves the original sent timestamp on update so edit detection works correctly', async () => {
    const originalSent = '2026-01-01T10:00:00.000Z';
    const existing = fakeNote({ sent: originalSent });
    mockFhirClient.fhir.get.mockResolvedValueOnce(fakePractitioner).mockResolvedValueOnce(existing);
    mockFhirClient.fhir.update.mockResolvedValue(fakeNote({ sent: originalSent }));

    await saveHandler(
      makeInput({ note: { ...baseNotePayload, resourceId: VALID_NOTE_ID, text: 'new text' } }, 'user-token')
    );

    const updated = mockFhirClient.fhir.update.mock.calls[0][0] as Communication;
    expect(updated.sent).toBe(originalSent);
  });
});

// ---------------------------------------------------------------------------
// delete-patient-note handler
// ---------------------------------------------------------------------------

describe('delete-patient-note handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMyPractitionerId).mockResolvedValue(CALLER_ID);
  });

  it('returns 200 and soft-deletes (entered-in-error) when tag is present and caller is the author', async () => {
    mockFhirClient.fhir.get.mockResolvedValue(fakeNote());
    mockFhirClient.fhir.update.mockResolvedValue(undefined);

    const result = await deleteHandler(makeInput({ resourceId: VALID_NOTE_ID }, 'user-token'));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).deleted).toBe(true);
    expect(mockFhirClient.fhir.update).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'Communication', id: VALID_NOTE_ID, status: 'entered-in-error' })
    );
    expect(mockFhirClient.fhir.delete).not.toHaveBeenCalled();
  });

  it('throws and does not soft-delete when the resource lacks the patient-note tag', async () => {
    const untagged = fakeNote({ meta: { tag: [{ system: 'other-system', code: 'other-code' }] } });
    mockFhirClient.fhir.get.mockResolvedValue(untagged);

    await expect(deleteHandler(makeInput({ resourceId: VALID_NOTE_ID }, 'user-token'))).rejects.toThrow(
      /not a patient note/i
    );

    expect(mockFhirClient.fhir.update).not.toHaveBeenCalled();
  });

  it('throws and does not soft-delete when the caller is not the author', async () => {
    const ownedByOther = fakeNote({ sender: { reference: `Practitioner/${OTHER_ID}` } });
    mockFhirClient.fhir.get.mockResolvedValue(ownedByOther);

    await expect(deleteHandler(makeInput({ resourceId: VALID_NOTE_ID }, 'user-token'))).rejects.toThrow(
      /not authorized/i
    );

    expect(mockFhirClient.fhir.update).not.toHaveBeenCalled();
  });

  it('throws and does not soft-delete when the resource has no meta at all', async () => {
    const noMeta = fakeNote({ meta: undefined });
    mockFhirClient.fhir.get.mockResolvedValue(noMeta);

    await expect(deleteHandler(makeInput({ resourceId: VALID_NOTE_ID }, 'user-token'))).rejects.toThrow(
      /not a patient note/i
    );

    expect(mockFhirClient.fhir.update).not.toHaveBeenCalled();
  });
});
