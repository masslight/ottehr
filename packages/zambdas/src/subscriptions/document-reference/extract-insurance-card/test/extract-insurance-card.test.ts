import { createHash } from 'node:crypto';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { Jimp } from 'jimp';
import {
  createOystehrClient,
  getPresignedURL,
  INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
  InsuranceCardExtraction,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPresignedUrl, getAuth0Token, uploadObjectToZ3, ZambdaInput } from '../../../../shared';
import { invokeChatbotVertexAI } from '../../../../shared/ai';
import { EXTRACTION_PROMPT, parseModelResponse } from '../helpers';
import { index } from '../index';
import { validateRequestParameters } from '../validateRequestParameters';
import { makeOrientedSceneJpeg, makePlainJpeg } from './image-fixtures';

vi.mock('../../../../shared/ai', () => ({
  invokeChatbotVertexAI: vi.fn(),
  VERTEX_AI_MODEL: 'gemini-3.1-flash-lite',
}));

vi.mock('../../../../shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared')>();
  return {
    ...actual,
    getAuth0Token: vi.fn(),
    createPresignedUrl: vi.fn(),
    uploadObjectToZ3: vi.fn(),
  };
});

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils')>();
  return {
    ...actual,
    createOystehrClient: vi.fn(),
    getPresignedURL: vi.fn(),
  };
});

const Z3_URL = 'https://project-api.zapehr.com/v1/z3/insurance-cards-bucket/patient-1/insurance-card-front.jpg';
const PRESIGNED_URL = 'https://signed.example.com/insurance-card-front.jpg';
const PRESIGNED_UPLOAD_URL = 'https://signed.example.com/insurance-card-front.jpg?upload';
// a real, already-normalized (small, upright, EXIF-less) JPEG so the mainline tests exercise the
// normalization no-op path rather than the graceful-fallback path
const IMAGE_BYTES = await makePlainJpeg(40, 24);
const IMAGE_SHA256 = createHash('sha256').update(new Uint8Array(IMAGE_BYTES)).digest('hex');

const sha256Of = (bytes: Buffer): string => createHash('sha256').update(new Uint8Array(bytes)).digest('hex');

const SECRETS = {
  FHIR_API: 'https://fhir-api.example.com',
  PROJECT_API: 'https://project-api.example.com',
  ENVIRONMENT: 'local',
};

const HAPPY_MODEL_RESPONSE = {
  isInsuranceCard: true,
  payer: 'Aetna',
  memberName: 'JOHN Q SAMPLE',
  memberId: 'W123456789',
  groupNumber: 'GRP-0001',
  payerId: '60054',
  rxBin: '610502',
  rxPcn: 'ADV',
  rxGroup: 'RX1234',
  insuranceType: 'PPO',
  effectiveDate: '2024-01-01',
  readable: true,
};

function makeDocRef(overrides: Partial<DocumentReference> = {}): DocumentReference {
  return {
    resourceType: 'DocumentReference',
    id: 'docref-1',
    status: 'current',
    type: { coding: [{ system: 'http://loinc.org', code: '64290-0' }] },
    content: [{ attachment: { url: Z3_URL, title: 'insurance-card-front', contentType: 'image/jpeg' } }],
    ...overrides,
  } as DocumentReference;
}

function makeInput(docRef: DocumentReference): ZambdaInput {
  return {
    body: JSON.stringify(docRef),
    headers: {},
    secrets: SECRETS,
  } as unknown as ZambdaInput;
}

function makeStoredExtraction(overrides: Partial<InsuranceCardExtraction> = {}): InsuranceCardExtraction {
  return {
    version: 1,
    isInsuranceCard: true,
    fields: {
      payer: 'Aetna',
      memberName: 'JOHN Q SAMPLE',
      memberId: 'W123456789',
      groupNumber: 'GRP-0001',
      payerId: '60054',
      rxBin: '610502',
      rxPcn: 'ADV',
      rxGroup: 'RX1234',
      insuranceType: 'PPO',
      effectiveDate: '2024-01-01',
    },
    readable: true,
    sourceDocRefId: 'docref-1',
    sourceAttachmentUrl: Z3_URL,
    imageHash: IMAGE_SHA256,
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

function setupHappyMocks(docRefInFhir: DocumentReference, imageBytes: Buffer = IMAGE_BYTES): void {
  mockSearch.mockResolvedValue({ unbundle: () => [docRefInFhir] });
  mockPatch.mockResolvedValue(docRefInFhir);
  vi.mocked(getPresignedURL).mockResolvedValue(PRESIGNED_URL);
  vi.mocked(createPresignedUrl).mockResolvedValue(PRESIGNED_UPLOAD_URL);
  vi.mocked(uploadObjectToZ3).mockResolvedValue(undefined);
  fetchMock.mockResolvedValue(imageFetchResponse(imageBytes));
  vi.mocked(invokeChatbotVertexAI).mockResolvedValue(JSON.stringify(HAPPY_MODEL_RESPONSE));
}

/** Finds the patch call that writes the extraction extension (there may also be an attachment-metadata patch). */
function getPatchedExtraction(): InsuranceCardExtraction {
  const extensionCalls = mockPatch.mock.calls.filter(([arg]) =>
    (arg.operations as { path: string }[]).some((op) => op.path.startsWith('/extension'))
  );
  expect(extensionCalls).toHaveLength(1);
  const { operations } = extensionCalls[0][0];
  expect(operations).toHaveLength(1);
  const extension =
    operations[0].op === 'add' && operations[0].path === '/extension' ? operations[0].value[0] : operations[0].value;
  expect(extension.url).toBe(INSURANCE_CARD_EXTRACTION_EXTENSION_URL);
  return JSON.parse(extension.valueString);
}

/** Finds the patch calls that update the attachment metadata after a re-store. */
function getAttachmentMetadataPatches(): { path: string; op: string; value: unknown }[][] {
  return mockPatch.mock.calls
    .filter(([arg]) => (arg.operations as { path: string }[]).some((op) => op.path.startsWith('/content/')))
    .map(([arg]) => arg.operations);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(getAuth0Token).mockResolvedValue('mock-m2m-token');
  vi.mocked(createOystehrClient).mockReturnValue(mockOystehr as any);
});

describe('extract-insurance-card validateRequestParameters', () => {
  it('throws MISSING_REQUEST_BODY when there is no body', () => {
    expect(() => validateRequestParameters({ headers: {}, secrets: null } as unknown as ZambdaInput)).toThrow();
  });

  it('rejects a non-DocumentReference resource', () => {
    const input = { body: JSON.stringify({ resourceType: 'Communication', id: 'c1' }), headers: {}, secrets: null };
    try {
      validateRequestParameters(input as unknown as ZambdaInput);
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('Expected DocumentReference');
    }
  });

  it('rejects a DocumentReference without the insurance-card type coding', () => {
    const docRef = makeDocRef({ type: { coding: [{ system: 'http://loinc.org', code: '55188-7' }] } });
    try {
      validateRequestParameters(makeInput(docRef));
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('64290-0');
    }
  });

  it('rejects a non-current DocumentReference', () => {
    const docRef = makeDocRef({ status: 'superseded' });
    try {
      validateRequestParameters(makeInput(docRef));
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('Expected current status');
    }
  });

  it('rejects a DocumentReference with no attachment url', () => {
    const docRef = makeDocRef({ content: [{ attachment: { title: 'insurance-card-front' } }] });
    try {
      validateRequestParameters(makeInput(docRef));
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('has no attachment URL');
    }
  });

  it('gracefully skips (not error) the fullInsuranceCard PDF title', () => {
    const docRef = makeDocRef({
      content: [{ attachment: { url: Z3_URL, title: 'fullInsuranceCard', contentType: 'application/pdf' } }],
    });
    const result = validateRequestParameters(makeInput(docRef));
    expect(result.skip).toBe(true);
  });

  it.each(['insurance-card-front', 'insurance-card-back', 'insurance-card-front-2', 'insurance-card-back-2'])(
    'accepts card image title %s',
    (title) => {
      const docRef = makeDocRef({ content: [{ attachment: { url: Z3_URL, title } }] });
      const result = validateRequestParameters(makeInput(docRef));
      expect(result.skip).toBe(false);
      if (!result.skip) {
        expect(result.cardSlot).toBe(title);
        expect(result.attachmentUrl).toBe(Z3_URL);
      }
    }
  );
});

describe('extract-insurance-card handler', () => {
  it('extracts and stores a well-formed InsuranceCardExtraction on the DocumentReference (happy path)', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ documentReferenceId: 'docref-1', extracted: true });

    // model call: prompt + inline image, schema, and PHI response logging suppressed
    expect(invokeChatbotVertexAI).toHaveBeenCalledTimes(1);
    const [parts, , schema, options] = vi.mocked(invokeChatbotVertexAI).mock.calls[0];
    expect(parts[0]).toEqual({ text: EXTRACTION_PROMPT });
    expect((parts[1] as any).inlineData.mimeType).toBe('image/jpeg');
    expect((parts[1] as any).inlineData.data).toBe(IMAGE_BYTES.toString('base64'));
    expect((schema as any).properties.isInsuranceCard).toEqual({ type: 'boolean' });
    // schema regression guard: the orientation signal must be requested on every call
    expect((schema as any).properties.readable).toEqual({ type: 'boolean', nullable: true });
    expect((schema as any).required).toContain('readable');
    expect(options).toEqual({ suppressResponseLogging: true });

    const stored = getPatchedExtraction();
    expect(stored).toMatchObject({
      version: 1,
      isInsuranceCard: true,
      fields: {
        payer: 'Aetna',
        memberName: 'JOHN Q SAMPLE',
        memberId: 'W123456789',
        groupNumber: 'GRP-0001',
        payerId: '60054',
        rxBin: '610502',
        rxPcn: 'ADV',
        rxGroup: 'RX1234',
        insuranceType: 'PPO',
        effectiveDate: '2024-01-01',
      },
      readable: true,
      sourceDocRefId: 'docref-1',
      sourceAttachmentUrl: Z3_URL,
      imageHash: IMAGE_SHA256,
      model: 'gemini-3.1-flash-lite',
    });
    expect(stored.notACard).toBeUndefined();
    expect(typeof stored.extractedAt).toBe('string');

    // patch shape: DocRef had no extensions -> add /extension
    expect(mockPatch.mock.calls[0][0]).toMatchObject({
      resourceType: 'DocumentReference',
      id: 'docref-1',
      operations: [expect.objectContaining({ op: 'add', path: '/extension' })],
    });
  });

  it('stores readable=false when the model judges the card mis-oriented but still extracts fields', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    vi.mocked(invokeChatbotVertexAI).mockResolvedValue(JSON.stringify({ ...HAPPY_MODEL_RESPONSE, readable: false }));

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ extracted: true });
    const stored = getPatchedExtraction();
    expect(stored.readable).toBe(false);
    expect(stored.fields).toMatchObject({ memberId: 'W123456789' });
    expect(stored.notACard).toBeUndefined();
  });

  it('appends to an existing extension array with add /extension/-', async () => {
    const docRef = makeDocRef({ extension: [{ url: 'https://example.com/other-extension', valueString: 'x' }] });
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(mockPatch.mock.calls[0][0].operations[0]).toMatchObject({ op: 'add', path: '/extension/-' });
  });

  it('writes the notACard marker (fields null) and no-ops when isInsuranceCard is false', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    vi.mocked(invokeChatbotVertexAI).mockResolvedValue(
      JSON.stringify({
        isInsuranceCard: false,
        payer: null,
        memberName: null,
        memberId: null,
        groupNumber: null,
        payerId: null,
        rxBin: null,
        rxPcn: null,
        rxGroup: null,
        insuranceType: null,
        effectiveDate: null,
        readable: null,
      })
    );

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ extracted: false, notACard: true });

    const stored = getPatchedExtraction();
    expect(stored.notACard).toBe(true);
    expect(stored.isInsuranceCard).toBe(false);
    expect(stored.fields).toBeNull();
    expect(stored.readable).toBeNull();
    expect(stored.sourceAttachmentUrl).toBe(Z3_URL);
  });

  it('is idempotent: a repeat fire with the same attachment no-ops without calling the model', async () => {
    const docRef = makeDocRef({
      extension: [
        {
          url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
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

  it('is idempotent for a stored notACard marker too', async () => {
    const docRef = makeDocRef({
      extension: [
        {
          url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
          valueString: JSON.stringify(makeStoredExtraction({ isInsuranceCard: false, fields: null, notACard: true })),
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
          url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
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

  it('propagates a retryable error (not a 200 no-op) when the card image fails to download', async () => {
    // A download failure is often transient (network blip, presigned url race); returning 200
    // would tell the subscription "handled" and permanently strand the card unprocessed, so this
    // must surface as a non-200 the subscription's retry semantics can act on.
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    fetchMock.mockResolvedValue({ ok: false, status: 403, headers: { get: () => null } });

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(500);
    expect(captureException).toHaveBeenCalled();
    expect(invokeChatbotVertexAI).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('writes a permanent notACard marker for unsupported (non-image, non-pdf) content', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
      arrayBuffer: async () =>
        IMAGE_BYTES.buffer.slice(IMAGE_BYTES.byteOffset, IMAGE_BYTES.byteOffset + IMAGE_BYTES.byteLength),
    });

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ skipped: true, notACard: true });
    expect(invokeChatbotVertexAI).not.toHaveBeenCalled();
    const stored = getPatchedExtraction();
    expect(stored.notACard).toBe(true);
    expect(stored.fields).toBeNull();
    expect(stored.readable).toBeNull();
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

  it('normalizes a rotated card: re-stores to the same Z3 url, patches metadata, and OCRs the normalized bytes', async () => {
    const docRef = makeDocRef();
    const rotated = await makeOrientedSceneJpeg(6, 32, 16); // stored 16x32, EXIF orientation 6
    setupHappyMocks(docRef, rotated);

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ documentReferenceId: 'docref-1', extracted: true });

    // re-store goes to the SAME attachment url (idempotency key unchanged)
    expect(createPresignedUrl).toHaveBeenCalledWith('mock-m2m-token', Z3_URL, 'upload');
    expect(uploadObjectToZ3).toHaveBeenCalledTimes(1);
    const [uploadedBytes, uploadUrl, uploadedMime] = vi.mocked(uploadObjectToZ3).mock.calls[0];
    expect(uploadUrl).toBe(PRESIGNED_UPLOAD_URL);
    expect(uploadedMime).toBe('image/jpeg');

    // the stored object is now upright: dimensions back to the 32x16 scene
    const uploadedBuffer = Buffer.from(uploadedBytes as Uint8Array);
    const uprightImage = await Jimp.read(uploadedBuffer);
    expect(uprightImage.width).toBe(32);
    expect(uprightImage.height).toBe(16);

    // OCR ran on the NORMALIZED bytes, not the original upload
    const [parts] = vi.mocked(invokeChatbotVertexAI).mock.calls[0];
    expect((parts[1] as any).inlineData.data).toBe(uploadedBuffer.toString('base64'));
    expect((parts[1] as any).inlineData.data).not.toBe(rotated.toString('base64'));

    // stored imageHash covers the normalized (stored) bytes
    expect(getPatchedExtraction().imageHash).toBe(sha256Of(uploadedBuffer));

    // attachment metadata patch: contentType already image/jpeg, so only size is added
    const metadataPatches = getAttachmentMetadataPatches();
    expect(metadataPatches).toHaveLength(1);
    expect(metadataPatches[0]).toEqual([
      { op: 'add', path: '/content/0/attachment/size', value: uploadedBuffer.length },
    ]);
  });

  it('still succeeds when the attachment-metadata patch fails after the re-store (non-fatal branch)', async () => {
    const docRef = makeDocRef();
    const rotated = await makeOrientedSceneJpeg(6, 32, 16);
    setupHappyMocks(docRef, rotated);
    // fail ONLY the attachment-metadata patch; the extraction-extension patch still succeeds
    mockPatch.mockImplementation(async (arg: { operations: { path: string }[] }) => {
      if (arg.operations.some((op) => op.path.startsWith('/content/'))) {
        throw new Error('metadata patch failed');
      }
      return docRef;
    });

    const result = await invokeHandler(makeInput(docRef));

    // the zambda still succeeds: the stored object IS already the normalized image
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ documentReferenceId: 'docref-1', extracted: true });
    expect(captureException).toHaveBeenCalled(); // the swallowed patch failure is still reported

    // pipeline continued on the NORMALIZED bytes (they were re-stored before the patch attempt)
    expect(uploadObjectToZ3).toHaveBeenCalledTimes(1);
    const uploadedBuffer = Buffer.from(vi.mocked(uploadObjectToZ3).mock.calls[0][0] as Uint8Array);
    const [parts] = vi.mocked(invokeChatbotVertexAI).mock.calls[0];
    expect((parts[1] as any).inlineData.data).toBe(uploadedBuffer.toString('base64'));
    expect(getPatchedExtraction().imageHash).toBe(sha256Of(uploadedBuffer));
  });

  it('does not re-store an already-normalized (small, upright) card', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef); // IMAGE_BYTES is a small upright EXIF-less JPEG

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(createPresignedUrl).not.toHaveBeenCalled();
    expect(uploadObjectToZ3).not.toHaveBeenCalled();
    expect(getAttachmentMetadataPatches()).toHaveLength(0);
    expect(mockPatch).toHaveBeenCalledTimes(1); // the extraction write only
    expect(getPatchedExtraction().imageHash).toBe(IMAGE_SHA256);
  });

  it('falls back to OCR on the original bytes when normalization fails (undecodable image)', async () => {
    const docRef = makeDocRef();
    const junkBytes = Buffer.from('fake-insurance-card-image-bytes'); // labeled image/jpeg, not decodable
    setupHappyMocks(docRef, junkBytes);

    const result = await invokeHandler(makeInput(docRef));

    // card processing must never crash over a normalize failure
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ extracted: true });
    expect(captureException).toHaveBeenCalled();
    expect(uploadObjectToZ3).not.toHaveBeenCalled();

    const [parts] = vi.mocked(invokeChatbotVertexAI).mock.calls[0];
    expect((parts[1] as any).inlineData.data).toBe(junkBytes.toString('base64'));
    expect(getPatchedExtraction().imageHash).toBe(sha256Of(junkBytes));
  });

  it('falls back to the original bytes when the Z3 re-store fails (hash must match the stored object)', async () => {
    const docRef = makeDocRef();
    const rotated = await makeOrientedSceneJpeg(6, 32, 16);
    setupHappyMocks(docRef, rotated);
    vi.mocked(uploadObjectToZ3).mockRejectedValue(new Error('z3 unavailable'));

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ extracted: true });
    expect(captureException).toHaveBeenCalled();
    expect(getAttachmentMetadataPatches()).toHaveLength(0);

    // the stored object is still the original upload, so OCR + hash use the original bytes
    const [parts] = vi.mocked(invokeChatbotVertexAI).mock.calls[0];
    expect((parts[1] as any).inlineData.data).toBe(rotated.toString('base64'));
    expect(getPatchedExtraction().imageHash).toBe(sha256Of(rotated));
  });

  it('returns 200 skipped for a DocumentReference whose title is not a card image slot', async () => {
    const docRef = makeDocRef({
      content: [{ attachment: { url: Z3_URL, title: 'fullInsuranceCard', contentType: 'application/pdf' } }],
    });

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ skipped: true });
    expect(mockSearch).not.toHaveBeenCalled();
    expect(invokeChatbotVertexAI).not.toHaveBeenCalled();
  });
});

describe('extract-insurance-card helpers', () => {
  it('EXTRACTION_PROMPT carries the 80840 and no-guessing instructions and asks for isInsuranceCard', () => {
    expect(EXTRACTION_PROMPT).toContain('80840');
    expect(EXTRACTION_PROMPT).toContain('isInsuranceCard');
    expect(EXTRACTION_PROMPT.toLowerCase()).toContain('do not guess');
    expect(EXTRACTION_PROMPT.toLowerCase()).toContain('not part of the insurance card');
  });

  it('EXTRACTION_PROMPT asks for the readable orientation judgment (right-side-up)', () => {
    expect(EXTRACTION_PROMPT).toContain('readable');
    expect(EXTRACTION_PROMPT.toLowerCase()).toContain('right-side-up');
    expect(EXTRACTION_PROMPT.toLowerCase()).toContain('upside-down');
  });

  it('parseModelResponse normalizes empty strings to null and folds an all-null result into fields=null', () => {
    const allEmpty = parseModelResponse(
      JSON.stringify({
        isInsuranceCard: true,
        payer: '',
        memberName: '  ',
        memberId: null,
        groupNumber: null,
        payerId: null,
        rxBin: null,
        rxPcn: null,
        rxGroup: null,
        insuranceType: null,
        effectiveDate: null,
      })
    );
    expect(allEmpty.isInsuranceCard).toBe(true);
    expect(allEmpty.fields).toBeNull();

    const some = parseModelResponse(JSON.stringify({ isInsuranceCard: true, memberId: ' W1 ' }));
    expect(some.fields).toMatchObject({ memberId: 'W1', payer: null });
  });

  it('parseModelResponse passes through a boolean readable and nulls it on the notACard / all-null paths', () => {
    // boolean readable is preserved alongside extracted fields
    const sideways = parseModelResponse(JSON.stringify({ isInsuranceCard: true, memberId: 'W1', readable: false }));
    expect(sideways.readable).toBe(false);
    const upright = parseModelResponse(JSON.stringify({ isInsuranceCard: true, memberId: 'W1', readable: true }));
    expect(upright.readable).toBe(true);

    // a missing / non-boolean readable is never fabricated
    const missing = parseModelResponse(JSON.stringify({ isInsuranceCard: true, memberId: 'W1' }));
    expect(missing.readable).toBeNull();
    const junk = parseModelResponse(JSON.stringify({ isInsuranceCard: true, memberId: 'W1', readable: 'yes' }));
    expect(junk.readable).toBeNull();

    // notACard -> null even if the model volunteered a boolean
    const notACard = parseModelResponse(JSON.stringify({ isInsuranceCard: false, readable: true }));
    expect(notACard.readable).toBeNull();

    // all-null extraction folds to fields=null and readable is nulled with it
    const allNull = parseModelResponse(JSON.stringify({ isInsuranceCard: true, readable: false }));
    expect(allNull.fields).toBeNull();
    expect(allNull.readable).toBeNull();
  });

  it('parseModelResponse throws on a response missing the boolean isInsuranceCard', () => {
    expect(() => parseModelResponse(JSON.stringify({ memberId: 'W1' }))).toThrow();
  });
});
