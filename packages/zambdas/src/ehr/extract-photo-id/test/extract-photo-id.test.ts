import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { createOystehrClient } from 'utils/lib/helpers/helpers';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { PHOTO_ID_EXTRACTION_EXTENSION_URL, PhotoIdExtraction } from 'utils/lib/types/data/documents';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeChatbotVertexAI } from '../../../shared/ai';
import { getAuth0Token } from '../../../shared/getAuth0Token';
import { ZambdaInput } from '../../../shared/types/common';
import { EXTRACTION_PROMPT, parseModelResponse, photoIdResponseSchema } from '../helpers';
import { index } from '../index';
import { validateRequestParameters } from '../validateRequestParameters';

vi.mock('../../../shared/ai', () => ({
  invokeChatbotVertexAI: vi.fn(),
  VERTEX_AI_MODEL: 'gemini-3.1-flash-lite',
}));

vi.mock('../../../shared/getAuth0Token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/getAuth0Token')>();
  return {
    ...actual,
    getAuth0Token: vi.fn(),
  };
});

vi.mock('utils/lib/helpers/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils/lib/helpers/helpers')>();
  return {
    ...actual,
    createOystehrClient: vi.fn(),
  };
});

vi.mock('utils/lib/helpers/presigned-file-url/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils/lib/helpers/presigned-file-url/helpers')>();
  return {
    ...actual,
    getPresignedURL: vi.fn(),
  };
});

const Z3_URL = 'https://project-api.zapehr.com/v1/z3/photo-id-cards-bucket/patient-1/photo-id-front.jpg';
const PRESIGNED_URL = 'https://signed.example.com/photo-id-front.jpg';
// no image normalization on this pipeline, so the bytes are never decoded — plain fake bytes suffice
const IMAGE_BYTES = Buffer.from('fake-photo-id-image-bytes');

const SECRETS = {
  FHIR_API: 'https://fhir-api.example.com',
  PROJECT_API: 'https://project-api.example.com',
  ENVIRONMENT: 'local',
};

const HAPPY_MODEL_RESPONSE = {
  isPhotoId: true,
  firstName: 'JOHN',
  middleName: 'QUINCY',
  lastName: 'SAMPLE',
  suffix: 'JR',
  dateOfBirth: '1990-02-14',
  sex: 'Male',
  addressLine1: '123 MAIN ST',
  addressLine2: null,
  addressCity: 'SPRINGFIELD',
  addressState: 'MA',
  addressZip: '01101',
  licenseNumber: 'S12345678',
  expirationDate: '2028-02-14',
};

const HAPPY_FIELDS = {
  firstName: 'JOHN',
  middleName: 'QUINCY',
  lastName: 'SAMPLE',
  suffix: 'JR',
  dateOfBirth: '1990-02-14',
  sex: 'Male',
  addressLine1: '123 MAIN ST',
  addressLine2: null,
  addressCity: 'SPRINGFIELD',
  addressState: 'MA',
  addressZip: '01101',
  licenseNumber: 'S12345678',
  expirationDate: '2028-02-14',
};

function makeDocRef(overrides: Partial<DocumentReference> = {}): DocumentReference {
  return {
    resourceType: 'DocumentReference',
    id: 'docref-1',
    status: 'current',
    type: { coding: [{ system: 'http://loinc.org', code: '55188-7' }] },
    content: [{ attachment: { url: Z3_URL, title: 'photo-id-front', contentType: 'image/jpeg' } }],
    ...overrides,
  } as DocumentReference;
}

function makeInput(docRef: DocumentReference): ZambdaInput {
  return {
    body: JSON.stringify({ documentReferenceId: docRef.id }),
    headers: {},
    secrets: SECRETS,
  } as unknown as ZambdaInput;
}

function makeStoredExtraction(overrides: Partial<PhotoIdExtraction> = {}): PhotoIdExtraction {
  return {
    version: 1,
    isPhotoId: true,
    fields: { ...HAPPY_FIELDS },
    sourceDocRefId: 'docref-1',
    sourceAttachmentUrl: Z3_URL,
    model: 'gemini-3.1-flash-lite',
    extractedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const mockSearch = vi.fn();
const mockPatch = vi.fn();
const mockOystehr = { fhir: { search: mockSearch, patch: mockPatch } };
const fetchMock = vi.fn();

async function invokeHandler(input: ZambdaInput): Promise<APIGatewayProxyResult> {
  // vitest.setup.ts mocks sentry's wrapHandler as a pass-through, so the handler is directly callable
  return (await (index as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>)(input))!;
}

function imageFetchResponse(bytes: Buffer, contentType = 'image/jpeg'): Record<string, unknown> {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function setupHappyMocks(docRefInFhir: DocumentReference): void {
  mockSearch.mockResolvedValue({ unbundle: () => [docRefInFhir] });
  mockPatch.mockResolvedValue(docRefInFhir);
  vi.mocked(getPresignedURL).mockResolvedValue(PRESIGNED_URL);
  fetchMock.mockResolvedValue(imageFetchResponse(IMAGE_BYTES));
  vi.mocked(invokeChatbotVertexAI).mockResolvedValue(JSON.stringify(HAPPY_MODEL_RESPONSE));
}

/** Finds the single patch call and returns the extraction it writes. */
function getPatchedExtraction(): PhotoIdExtraction {
  expect(mockPatch).toHaveBeenCalledTimes(1);
  const { operations } = mockPatch.mock.calls[0][0];
  expect(operations).toHaveLength(1);
  const extension =
    operations[0].op === 'add' && operations[0].path === '/extension' ? operations[0].value[0] : operations[0].value;
  expect(extension.url).toBe(PHOTO_ID_EXTRACTION_EXTENSION_URL);
  return JSON.parse(extension.valueString);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(getAuth0Token).mockResolvedValue('mock-m2m-token');
  vi.mocked(createOystehrClient).mockReturnValue(mockOystehr as any);
});

describe('extract-photo-id validateRequestParameters', () => {
  it('throws MISSING_REQUEST_BODY when there is no body', () => {
    expect(() => validateRequestParameters({ headers: {}, secrets: null } as unknown as ZambdaInput)).toThrow();
  });

  it('rejects a body missing documentReferenceId', () => {
    const input = { body: JSON.stringify({}), headers: {}, secrets: null };
    try {
      validateRequestParameters(input as unknown as ZambdaInput);
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('documentReferenceId');
    }
  });

  it('rejects a non-string documentReferenceId', () => {
    const input = { body: JSON.stringify({ documentReferenceId: 42 }), headers: {}, secrets: null };
    try {
      validateRequestParameters(input as unknown as ZambdaInput);
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('documentReferenceId');
    }
  });

  it('returns the documentReferenceId and secrets on success', () => {
    const result = validateRequestParameters(makeInput(makeDocRef()));
    expect(result).toEqual({ documentReferenceId: 'docref-1', secrets: SECRETS });
  });
});

describe('extract-photo-id handler', () => {
  it('extracts and stores a well-formed PhotoIdExtraction on the DocumentReference (happy path)', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ documentReferenceId: 'docref-1', extracted: true });

    // model call: prompt + inline image + schema
    expect(invokeChatbotVertexAI).toHaveBeenCalledTimes(1);
    const [parts, , schema] = vi.mocked(invokeChatbotVertexAI).mock.calls[0];
    expect(parts[0]).toEqual({ text: EXTRACTION_PROMPT });
    expect((parts[1] as any).inlineData.mimeType).toBe('image/jpeg');
    expect((parts[1] as any).inlineData.data).toBe(IMAGE_BYTES.toString('base64'));
    expect(schema).toBe(photoIdResponseSchema);
    expect((schema as any).properties.isPhotoId).toEqual({ type: 'boolean' });

    const stored = getPatchedExtraction();
    expect(stored).toMatchObject({
      version: 1,
      isPhotoId: true,
      fields: HAPPY_FIELDS,
      sourceDocRefId: 'docref-1',
      sourceAttachmentUrl: Z3_URL,
      model: 'gemini-3.1-flash-lite',
    });
    expect(stored.notAPhotoId).toBeUndefined();
    expect(typeof stored.extractedAt).toBe('string');

    // patch shape: DocRef had no extensions -> add /extension
    expect(mockPatch.mock.calls[0][0]).toMatchObject({
      resourceType: 'DocumentReference',
      id: 'docref-1',
      operations: [expect.objectContaining({ op: 'add', path: '/extension' })],
    });
  });

  it('appends to an existing extension array with add /extension/-', async () => {
    const docRef = makeDocRef({ extension: [{ url: 'https://example.com/other-extension', valueString: 'x' }] });
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(mockPatch.mock.calls[0][0].operations[0]).toMatchObject({ op: 'add', path: '/extension/-' });
  });

  it('writes the notAPhotoId marker (fields null) and no-ops when isPhotoId is false', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    vi.mocked(invokeChatbotVertexAI).mockResolvedValue(
      JSON.stringify({
        isPhotoId: false,
        firstName: null,
        middleName: null,
        lastName: null,
        suffix: null,
        dateOfBirth: null,
        sex: null,
        addressLine1: null,
        addressCity: null,
        addressState: null,
        addressZip: null,
        licenseNumber: null,
        expirationDate: null,
      })
    );

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ extracted: false, notAPhotoId: true });

    const stored = getPatchedExtraction();
    expect(stored.notAPhotoId).toBe(true);
    expect(stored.isPhotoId).toBe(false);
    expect(stored.fields).toBeNull();
    expect(stored.sourceAttachmentUrl).toBe(Z3_URL);
  });

  it('writes the notAPhotoId marker when isPhotoId is true but every field is null (all-null fold)', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    vi.mocked(invokeChatbotVertexAI).mockResolvedValue(JSON.stringify({ isPhotoId: true }));

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ extracted: false, notAPhotoId: true });
    const stored = getPatchedExtraction();
    expect(stored.notAPhotoId).toBe(true);
    expect(stored.fields).toBeNull();
  });

  it('is idempotent: a repeat fire with the same attachment no-ops without calling the model', async () => {
    const docRef = makeDocRef({
      extension: [
        {
          url: PHOTO_ID_EXTRACTION_EXTENSION_URL,
          valueString: JSON.stringify(makeStoredExtraction()),
        },
      ],
    });
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ documentReferenceId: 'docref-1', alreadyProcessed: true });
    expect(getPresignedURL).not.toHaveBeenCalled();
    expect(invokeChatbotVertexAI).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('is idempotent for a stored notAPhotoId marker too', async () => {
    const docRef = makeDocRef({
      extension: [
        {
          url: PHOTO_ID_EXTRACTION_EXTENSION_URL,
          valueString: JSON.stringify(makeStoredExtraction({ isPhotoId: false, fields: null, notAPhotoId: true })),
        },
      ],
    });
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(docRef));

    expect(JSON.parse(result.body)).toMatchObject({ alreadyProcessed: true });
    expect(invokeChatbotVertexAI).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('re-extracts (replace) when the stored extraction is for a different attachment url', async () => {
    const docRef = makeDocRef({
      extension: [
        {
          url: PHOTO_ID_EXTRACTION_EXTENSION_URL,
          valueString: JSON.stringify(
            makeStoredExtraction({ sourceAttachmentUrl: 'https://project-api.zapehr.com/v1/z3/old-image.jpg' })
          ),
        },
      ],
    });
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(invokeChatbotVertexAI).toHaveBeenCalledTimes(1);
    expect(mockPatch.mock.calls[0][0].operations[0]).toMatchObject({ op: 'replace', path: '/extension/0' });
  });

  it('no-ops when the DocumentReference was superseded between trigger and execution', async () => {
    const docRef = makeDocRef();
    setupHappyMocks({ ...docRef, status: 'superseded' });

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ skipped: true });
    expect(getPresignedURL).not.toHaveBeenCalled();
    expect(invokeChatbotVertexAI).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('propagates a retryable error (not a 200 no-op) when the ID image fails to download', async () => {
    // A download failure is often transient (network blip, presigned url race); returning 200
    // would tell the caller "handled" and permanently strand the ID unprocessed, so this must
    // surface as a non-200 a retrying caller can act on.
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    fetchMock.mockResolvedValue({ ok: false, status: 403, headers: { get: () => null } });

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(500);
    expect(captureException).toHaveBeenCalled();
    expect(invokeChatbotVertexAI).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("falls back to the attachment's own contentType when Z3 returns application/octet-stream", async () => {
    // Z3 returns the generic application/octet-stream when the object's content type wasn't
    // recorded at upload time; a real ID image must not be marked unsupported because of that.
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    fetchMock.mockResolvedValue(imageFetchResponse(IMAGE_BYTES, 'application/octet-stream'));

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ extracted: true });
    const [parts] = vi.mocked(invokeChatbotVertexAI).mock.calls[0];
    expect((parts[1] as any).inlineData.mimeType).toBe('image/jpeg');
  });

  it('writes a permanent notAPhotoId marker for unsupported (non-image, non-pdf) content', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    fetchMock.mockResolvedValue(imageFetchResponse(IMAGE_BYTES, 'text/html; charset=utf-8'));

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ skipped: true, notAPhotoId: true });
    expect(invokeChatbotVertexAI).not.toHaveBeenCalled();
    const stored = getPatchedExtraction();
    expect(stored.notAPhotoId).toBe(true);
    expect(stored.fields).toBeNull();
  });

  it('returns 500 (retryable) and reports when the model returns unparseable JSON', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    vi.mocked(invokeChatbotVertexAI).mockResolvedValue('this is not json');

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(500);
    expect(captureException).toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('returns 200 skipped for a photo-id-back DocumentReference', async () => {
    const docRef = makeDocRef({
      content: [{ attachment: { url: Z3_URL, title: 'photo-id-back', contentType: 'image/jpeg' } }],
    });
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ skipped: true });
    expect(invokeChatbotVertexAI).not.toHaveBeenCalled();
  });

  it('no-ops when the DocumentReference has no attachment URL', async () => {
    const docRef = makeDocRef({ content: [{ attachment: { title: 'photo-id-front' } }] });
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ skipped: true });
    expect(invokeChatbotVertexAI).not.toHaveBeenCalled();
  });
});

describe('extract-photo-id helpers', () => {
  it('EXTRACTION_PROMPT asks for the isPhotoId classifier and forbids guessing', () => {
    expect(EXTRACTION_PROMPT).toContain('isPhotoId');
    expect(EXTRACTION_PROMPT.toLowerCase()).toContain('do not guess');
    expect(EXTRACTION_PROMPT.toLowerCase()).toContain('not part of the id card');
  });

  it('EXTRACTION_PROMPT carries the LAST, FIRST MIDDLE name-splitting rule', () => {
    expect(EXTRACTION_PROMPT).toContain('LAST, FIRST MIDDLE');
    expect(EXTRACTION_PROMPT.toLowerCase()).toContain('split');
  });

  it('parseModelResponse normalizes empty strings to null and folds an all-null result into fields=null', () => {
    const allEmpty = parseModelResponse(
      JSON.stringify({
        isPhotoId: true,
        firstName: '',
        lastName: '  ',
        middleName: null,
        suffix: null,
        dateOfBirth: null,
        sex: null,
        addressLine1: null,
        addressCity: null,
        addressState: null,
        addressZip: null,
        licenseNumber: null,
        expirationDate: null,
      })
    );
    expect(allEmpty.isPhotoId).toBe(true);
    expect(allEmpty.fields).toBeNull();

    const some = parseModelResponse(JSON.stringify({ isPhotoId: true, lastName: ' SAMPLE ' }));
    expect(some.fields).toMatchObject({ lastName: 'SAMPLE', firstName: null });
  });

  it('parseModelResponse normalizes sex to Male/Female when clear and passes other values through', () => {
    expect(parseModelResponse(JSON.stringify({ isPhotoId: true, sex: 'M' })).fields?.sex).toBe('Male');
    expect(parseModelResponse(JSON.stringify({ isPhotoId: true, sex: 'f' })).fields?.sex).toBe('Female');
    expect(parseModelResponse(JSON.stringify({ isPhotoId: true, sex: 'Female' })).fields?.sex).toBe('Female');
    expect(parseModelResponse(JSON.stringify({ isPhotoId: true, sex: 'X' })).fields?.sex).toBe('X');
  });

  it('parseModelResponse returns null fields when isPhotoId is false, ignoring any volunteered values', () => {
    const result = parseModelResponse(JSON.stringify({ isPhotoId: false, firstName: 'JOHN' }));
    expect(result.isPhotoId).toBe(false);
    expect(result.fields).toBeNull();
  });

  it('parseModelResponse throws on a response missing the boolean isPhotoId', () => {
    expect(() => parseModelResponse(JSON.stringify({ firstName: 'JOHN' }))).toThrow();
    expect(() => parseModelResponse('this is not json')).toThrow();
  });
});
