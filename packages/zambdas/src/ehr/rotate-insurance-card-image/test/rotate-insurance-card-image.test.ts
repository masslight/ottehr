import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { Jimp } from 'jimp';
import { APIErrorCode, getPresignedURL, INSURANCE_CARD_EXTRACTION_EXTENSION_URL, InsuranceCardExtraction } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  createPresignedUrl,
  uploadObjectToZ3,
  ZambdaInput,
} from '../../../shared';
import { sha256Hex } from '../../../subscriptions/document-reference/extract-insurance-card/helpers';
import {
  isRedAt,
  makeOrientedSceneJpeg,
} from '../../../subscriptions/document-reference/extract-insurance-card/test/image-fixtures';
import { index } from '../index';
import { validateRequestParameters } from '../validateRequestParameters';

vi.mock('../../../shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared')>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn(),
    createClinicalOystehrClient: vi.fn(),
    createPresignedUrl: vi.fn(),
    uploadObjectToZ3: vi.fn(),
  };
});

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils')>();
  return {
    ...actual,
    getPresignedURL: vi.fn(),
  };
});

const DOC_REF_ID = '0a4f6f4e-2e1f-4a3b-9d5c-8e7f6a5b4c3d';
const Z3_URL = 'https://project-api.zapehr.com/v1/z3/insurance-cards-bucket/patient-1/insurance-card-front.jpg';
const PRESIGNED_URL = 'https://signed.example.com/insurance-card-front.jpg';
const PRESIGNED_UPLOAD_URL = 'https://signed.example.com/insurance-card-front.jpg?upload';

// 32x16 "scene": red block in the TOP-LEFT quadrant, white elsewhere (EXIF orientation 1 = identity).
// The red quadrant's landing corner after rotation proves the rotate DIRECTION, independent of jimp.
const SCENE_W = 32;
const SCENE_H = 16;
const IMAGE_BYTES = await makeOrientedSceneJpeg(1, SCENE_W, SCENE_H);

const SECRETS = {
  AUTH0_AUDIENCE: 'https://api.zapehr.com',
  ENVIRONMENT: 'local',
};

function makeDocRef(overrides: Partial<DocumentReference> = {}): DocumentReference {
  return {
    resourceType: 'DocumentReference',
    id: DOC_REF_ID,
    status: 'current',
    type: { coding: [{ system: 'http://loinc.org', code: '64290-0' }] },
    content: [{ attachment: { url: Z3_URL, title: 'insurance-card-front', contentType: 'image/jpeg' } }],
    ...overrides,
  } as DocumentReference;
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
    readable: false, // the "looks rotated" hint the manual rotate must clear
    sourceDocRefId: DOC_REF_ID,
    sourceAttachmentUrl: Z3_URL,
    imageHash: sha256Hex(IMAGE_BYTES),
    model: 'gemini-3.1-flash-lite',
    extractedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeInput(
  body: unknown,
  headers: Record<string, string> = { Authorization: 'Bearer user-token' }
): ZambdaInput {
  return {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
    secrets: SECRETS,
  } as unknown as ZambdaInput;
}

const ROTATE_BODY = { documentReferenceId: DOC_REF_ID, rotationDegrees: 90 };

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
}

function uploadedBuffer(): Buffer {
  expect(uploadObjectToZ3).toHaveBeenCalledTimes(1);
  const [uploadedBytes] = vi.mocked(uploadObjectToZ3).mock.calls[0];
  return Buffer.from(uploadedBytes as Uint8Array);
}

/** The single patch call's operations, split by target. */
function getPatchOperations(): { path: string; op: string; value?: any }[] {
  expect(mockPatch).toHaveBeenCalledTimes(1);
  return mockPatch.mock.calls[0][0].operations;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(checkOrCreateM2MClientToken).mockResolvedValue('mock-m2m-token');
  vi.mocked(createClinicalOystehrClient).mockReturnValue(mockOystehr as any);
});

describe('rotate-insurance-card-image validateRequestParameters', () => {
  it('throws MISSING_AUTH_TOKEN when there is no Authorization header', () => {
    expect(() => validateRequestParameters(makeInput(ROTATE_BODY, {}))).toThrow();
  });

  it('throws MISSING_REQUEST_BODY when there is no body', () => {
    expect(() => validateRequestParameters(makeInput(undefined))).toThrow();
  });

  it('rejects a non-uuid documentReferenceId', () => {
    try {
      validateRequestParameters(makeInput({ ...ROTATE_BODY, documentReferenceId: 'DocumentReference/abc' }));
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
    }
  });

  it.each([0, 45, 360, -90, '90', undefined])('rejects rotationDegrees %s', (rotationDegrees) => {
    try {
      validateRequestParameters(makeInput({ documentReferenceId: DOC_REF_ID, rotationDegrees }));
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
    }
  });

  it.each([90, 180, 270])('accepts rotationDegrees %s and extracts the user token', (rotationDegrees) => {
    const result = validateRequestParameters(makeInput({ documentReferenceId: DOC_REF_ID, rotationDegrees }));
    expect(result).toMatchObject({ documentReferenceId: DOC_REF_ID, rotationDegrees, userToken: 'user-token' });
  });
});

describe('rotate-insurance-card-image handler', () => {
  it('rotates 90deg CLOCKWISE, re-stores to the same Z3 url, updates size, and resets readable to null', async () => {
    const docRef = makeDocRef({
      extension: [
        { url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL, valueString: JSON.stringify(makeStoredExtraction()) },
      ],
    });
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(ROTATE_BODY));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documentReferenceId: DOC_REF_ID, rotated: true });

    // downloaded via presigned url for the attachment, re-stored to the SAME base url
    expect(getPresignedURL).toHaveBeenCalledWith(Z3_URL, 'mock-m2m-token');
    expect(createPresignedUrl).toHaveBeenCalledWith('mock-m2m-token', Z3_URL, 'upload');
    const [, uploadUrl, uploadedMime] = vi.mocked(uploadObjectToZ3).mock.calls[0];
    expect(uploadUrl).toBe(PRESIGNED_UPLOAD_URL);
    expect(uploadedMime).toBe('image/jpeg');

    // direction proof (real jimp, corner pixels): scene top-left red quadrant lands TOP-RIGHT
    // after a 90deg CLOCKWISE rotate, and the dimensions swap
    const uploaded = uploadedBuffer();
    const image = await Jimp.read(uploaded);
    expect(image.width).toBe(SCENE_H);
    expect(image.height).toBe(SCENE_W);
    expect(isRedAt(image, SCENE_H - 1, 0)).toBe(true); // top-right
    expect(isRedAt(image, 0, 0)).toBe(false); // top-left
    expect(isRedAt(image, 0, SCENE_W - 1)).toBe(false); // bottom-left (where a CCW bug would put it)
    expect(isRedAt(image, SCENE_H - 1, SCENE_W - 1)).toBe(false); // bottom-right

    // one patch: attachment size updated + extraction rewritten with readable=null and the new hash
    const operations = getPatchOperations();
    expect(operations).toContainEqual({ op: 'add', path: '/content/0/attachment/size', value: uploaded.length });
    const extensionOp = operations.find((op) => op.path === '/extension/0');
    expect(extensionOp?.op).toBe('replace');
    const rewritten = JSON.parse(extensionOp!.value.valueString) as InsuranceCardExtraction;
    expect(rewritten.readable).toBeNull();
    expect(rewritten.imageHash).toBe(sha256Hex(uploaded));
    // everything else about the extraction is preserved
    expect(rewritten.fields).toEqual(makeStoredExtraction().fields);
    expect(rewritten.sourceAttachmentUrl).toBe(Z3_URL);

    expect(captureException).not.toHaveBeenCalled();
  });

  it.each([
    // after rotating the scene's top-left red quadrant CLOCKWISE by N degrees, it lands at:
    { degrees: 180, width: SCENE_W, height: SCENE_H, redX: SCENE_W - 1, redY: SCENE_H - 1 }, // bottom-right
    { degrees: 270, width: SCENE_H, height: SCENE_W, redX: 0, redY: SCENE_W - 1 }, // bottom-left
  ])('rotates $degrees deg clockwise into the expected corner', async ({ degrees, width, height, redX, redY }) => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput({ documentReferenceId: DOC_REF_ID, rotationDegrees: degrees }));

    expect(result.statusCode).toBe(200);
    const image = await Jimp.read(uploadedBuffer());
    expect(image.width).toBe(width);
    expect(image.height).toBe(height);
    expect(isRedAt(image, redX, redY)).toBe(true);
    expect(isRedAt(image, 0, 0)).toBe(false);
  });

  it('skips the readable reset gracefully when no extraction extension exists (still updates size)', async () => {
    const docRef = makeDocRef(); // no extension
    setupHappyMocks(docRef);

    const result = await invokeHandler(makeInput(ROTATE_BODY));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documentReferenceId: DOC_REF_ID, rotated: true });
    const operations = getPatchOperations();
    expect(operations.every((op) => op.path.startsWith('/content/'))).toBe(true);
  });

  it('preserves unrelated extensions: the extraction rewrite targets only our extension index', async () => {
    const docRef = makeDocRef({
      extension: [
        { url: 'https://example.com/other-extension', valueString: 'x' },
        { url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL, valueString: JSON.stringify(makeStoredExtraction()) },
      ],
    });
    setupHappyMocks(docRef);

    await invokeHandler(makeInput(ROTATE_BODY));

    const extensionOp = getPatchOperations().find((op) => op.path.startsWith('/extension'));
    expect(extensionOp).toMatchObject({ op: 'replace', path: '/extension/1' });
  });

  it('returns FHIR_RESOURCE_NOT_FOUND when the DocumentReference does not exist', async () => {
    mockSearch.mockResolvedValue({ unbundle: () => [] });

    const result = await invokeHandler(makeInput(ROTATE_BODY));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({ code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND });
    expect(getPresignedURL).not.toHaveBeenCalled();
  });

  it.each([
    ['non insurance-card type coding', { type: { coding: [{ system: 'http://loinc.org', code: '55188-7' }] } }],
    ['superseded status', { status: 'superseded' }],
    ['missing attachment url', { content: [{ attachment: { title: 'insurance-card-front' } }] }],
    [
      'non card-image title (fullInsuranceCard pdf)',
      { content: [{ attachment: { url: Z3_URL, title: 'fullInsuranceCard', contentType: 'application/pdf' } }] },
    ],
    [
      'non-rotatable contentType',
      { content: [{ attachment: { url: Z3_URL, title: 'insurance-card-front', contentType: 'image/heic' } }] },
    ],
  ])('rejects a DocumentReference with %s (structured INVALID_INPUT, nothing touched)', async (_label, overrides) => {
    setupHappyMocks(makeDocRef(overrides as Partial<DocumentReference>));

    const result = await invokeHandler(makeInput(ROTATE_BODY));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({ code: APIErrorCode.INVALID_INPUT });
    expect(getPresignedURL).not.toHaveBeenCalled();
    expect(uploadObjectToZ3).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('reports an undownloadable image: captureException + structured 500, nothing stored', async () => {
    setupHappyMocks(makeDocRef());
    fetchMock.mockResolvedValue({ ok: false, status: 403, headers: { get: () => null } });

    const result = await invokeHandler(makeInput(ROTATE_BODY));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toMatchObject({ code: APIErrorCode.INSURANCE_CARD_IMAGE_GENERAL });
    expect(captureException).toHaveBeenCalled();
    expect(uploadObjectToZ3).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('reports a rotate failure (undecodable bytes): captureException + structured 500, nothing stored', async () => {
    setupHappyMocks(makeDocRef(), Buffer.from('fake-insurance-card-image-bytes'));

    const result = await invokeHandler(makeInput(ROTATE_BODY));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toMatchObject({ code: APIErrorCode.INSURANCE_CARD_IMAGE_GENERAL });
    expect(captureException).toHaveBeenCalled();
    expect(uploadObjectToZ3).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('reports a Z3 re-store failure: captureException + structured 500, DocRef untouched (retry-safe)', async () => {
    setupHappyMocks(makeDocRef());
    vi.mocked(uploadObjectToZ3).mockRejectedValue(new Error('z3 unavailable'));

    const result = await invokeHandler(makeInput(ROTATE_BODY));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toMatchObject({ code: APIErrorCode.INSURANCE_CARD_IMAGE_GENERAL });
    expect(captureException).toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('still returns rotated:true when the metadata patch fails (image already re-stored; a retry would double-rotate)', async () => {
    const docRef = makeDocRef({
      extension: [
        { url: INSURANCE_CARD_EXTRACTION_EXTENSION_URL, valueString: JSON.stringify(makeStoredExtraction()) },
      ],
    });
    setupHappyMocks(docRef);
    mockPatch.mockRejectedValue(new Error('fhir unavailable'));

    const result = await invokeHandler(makeInput(ROTATE_BODY));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ documentReferenceId: DOC_REF_ID, rotated: true });
    expect(uploadObjectToZ3).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalled();
  });
});
