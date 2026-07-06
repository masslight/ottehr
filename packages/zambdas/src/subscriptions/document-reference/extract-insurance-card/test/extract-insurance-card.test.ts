import { createHash } from 'node:crypto';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import {
  createOystehrClient,
  getPresignedURL,
  INSURANCE_CARD_EXTRACTION_EXTENSION_URL,
  InsuranceCardExtraction,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuth0Token, ZambdaInput } from '../../../../shared';
import { invokeChatbotVertexAI } from '../../../../shared/ai';
import { EXTRACTION_PROMPT, parseModelResponse } from '../helpers';
import { index } from '../index';
import { validateRequestParameters } from '../validateRequestParameters';

vi.mock('../../../../shared/ai', () => ({
  invokeChatbotVertexAI: vi.fn(),
  VERTEX_AI_MODEL: 'gemini-3.1-flash-lite',
}));

vi.mock('../../../../shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared')>();
  return {
    ...actual,
    getAuth0Token: vi.fn(),
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
const IMAGE_BYTES = Buffer.from('fake-insurance-card-image-bytes');
const IMAGE_SHA256 = createHash('sha256').update(new Uint8Array(IMAGE_BYTES)).digest('hex');

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

function setupHappyMocks(docRefInFhir: DocumentReference): void {
  mockSearch.mockResolvedValue({ unbundle: () => [docRefInFhir] });
  mockPatch.mockResolvedValue(docRefInFhir);
  vi.mocked(getPresignedURL).mockResolvedValue(PRESIGNED_URL);
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
    arrayBuffer: async () =>
      IMAGE_BYTES.buffer.slice(IMAGE_BYTES.byteOffset, IMAGE_BYTES.byteOffset + IMAGE_BYTES.byteLength),
  });
  vi.mocked(invokeChatbotVertexAI).mockResolvedValue(JSON.stringify(HAPPY_MODEL_RESPONSE));
}

function getPatchedExtraction(): InsuranceCardExtraction {
  expect(mockPatch).toHaveBeenCalledTimes(1);
  const { operations } = mockPatch.mock.calls[0][0];
  expect(operations).toHaveLength(1);
  const extension =
    operations[0].op === 'add' && operations[0].path === '/extension' ? operations[0].value[0] : operations[0].value;
  expect(extension.url).toBe(INSURANCE_CARD_EXTRACTION_EXTENSION_URL);
  return JSON.parse(extension.valueString);
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
      })
    );

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ extracted: false, notACard: true });

    const stored = getPatchedExtraction();
    expect(stored.notACard).toBe(true);
    expect(stored.isInsuranceCard).toBe(false);
    expect(stored.fields).toBeNull();
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

  it('handles an undownloadable image gracefully: captureException + 200 no-op, no marker written', async () => {
    const docRef = makeDocRef();
    setupHappyMocks(docRef);
    fetchMock.mockResolvedValue({ ok: false, status: 403, headers: { get: () => null } });

    const result = await invokeHandler(makeInput(docRef));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ skipped: true, extracted: false });
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

  it('parseModelResponse throws on a response missing the boolean isInsuranceCard', () => {
    expect(() => parseModelResponse(JSON.stringify({ memberId: 'W1' }))).toThrow();
  });
});
