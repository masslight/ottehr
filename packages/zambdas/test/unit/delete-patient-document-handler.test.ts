import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, List } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

// The exported `index` is typed as an AWS 3-arg Handler, but Sentry's own wrapHandler is mocked
// to hand back the single-arg inner function; cast the import to reflect the runtime shape.
type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr, mockDeleteZ3Object, mockCaptureException, mockCaptureMessage } = vi.hoisted(() => ({
  mockOystehr: {
    fhir: {
      search: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  },
  mockDeleteZ3Object: vi.fn(),
  mockCaptureException: vi.fn(),
  mockCaptureMessage: vi.fn(),
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createClinicalOystehrClient: vi.fn(() => mockOystehr),
  };
});

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  };
});

vi.mock('@sentry/aws-serverless', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    init: vi.fn(),
    isInitialized: vi.fn(() => true),
    setTag: vi.fn(),
    setTags: vi.fn(),
    captureException: mockCaptureException,
    captureMessage: mockCaptureMessage,
    wrapHandler: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock('../../src/shared/z3Utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    deleteZ3Object: mockDeleteZ3Object,
  };
});

import { APIErrorCode } from 'utils/lib/types/errors';
import { index as deletePatientDocumentRaw } from '../../src/ehr/delete-patient-document/index';
import { Z3Error } from '../../src/shared/z3Utils';

const deletePatientDocument = deletePatientDocumentRaw as unknown as ZambdaHandler;

const DOC_REF_ID = '11111111-1111-4111-8111-111111111111';
const Z3_BUCKET = 'project-1-patient-docs-custom-folders';
const Z3_URL = `https://project-api.example.com/z3/${Z3_BUCKET}/records/patient-1/scan.pdf`;

// Not 'local' — sendWarning and sendErrors both no-op there, and what reaches Sentry is asserted.
const secrets = {
  ENVIRONMENT: 'development',
  FHIR_API: 'https://fhir.example.com',
  PROJECT_API: 'https://project-api.example.com',
};

const input: ZambdaInput = {
  headers: { Authorization: 'Bearer test-token' },
  body: JSON.stringify({ documentRefId: DOC_REF_ID }),
  secrets,
};

const docRef: DocumentReference = {
  resourceType: 'DocumentReference',
  id: DOC_REF_ID,
  status: 'current',
  subject: { reference: 'Patient/patient-1' },
  content: [{ attachment: { url: Z3_URL, contentType: 'application/pdf' } }],
};

const list: List = {
  resourceType: 'List',
  id: 'list-1',
  status: 'current',
  mode: 'working',
  subject: { reference: 'Patient/patient-1' },
  entry: [{ item: { reference: `DocumentReference/${DOC_REF_ID}` } }],
};

function mockSearches({ docRefs = [docRef] }: { docRefs?: DocumentReference[] } = {}): void {
  mockOystehr.fhir.search.mockImplementation(({ resourceType }: { resourceType: string }) =>
    Promise.resolve({ unbundle: () => (resourceType === 'DocumentReference' ? docRefs : [list]) })
  );
}

describe('delete-patient-document handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.patch.mockResolvedValue(list);
    mockOystehr.fhir.delete.mockResolvedValue(undefined);
  });

  it('deletes the file, detaches the document from its lists, and deletes the DocumentReference', async () => {
    mockSearches();
    mockDeleteZ3Object.mockResolvedValue(undefined);

    const result = await deletePatientDocument(input);

    expect(result.statusCode).toBe(200);
    expect(mockDeleteZ3Object).toHaveBeenCalledWith(Z3_URL, 'mock-token');
    expect(mockOystehr.fhir.patch).toHaveBeenCalledTimes(1);
    expect(mockOystehr.fhir.delete).toHaveBeenCalledWith({ resourceType: 'DocumentReference', id: DOC_REF_ID });
  });

  it('answers a Z3 403 with a 4xx, leaves FHIR untouched, and reports it as a warning', async () => {
    mockSearches();
    mockDeleteZ3Object.mockRejectedValue(new Z3Error('Delete request was not OK: 403 Forbidden', 403));

    const result = await deletePatientDocument(input);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.FILE_STORAGE_REQUEST_REJECTED);
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.delete).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'Z3 refused a patient document file delete',
      expect.objectContaining({
        level: 'warning',
        extra: { documentRefId: DOC_REF_ID, bucket: Z3_BUCKET },
      })
    );
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it.each([401, 429] as const)('still reports a Z3 %i as a 500', async (status) => {
    mockSearches();
    mockDeleteZ3Object.mockRejectedValue(new Z3Error(`Delete request was not OK: ${status}`, status));

    const result = await deletePatientDocument(input);

    expect(result.statusCode).toBe(500);
    expect(mockOystehr.fhir.delete).not.toHaveBeenCalled();
  });

  it('continues when the Z3 object is already gone (404)', async () => {
    mockSearches();
    mockDeleteZ3Object.mockRejectedValue(new Z3Error('Delete request was not OK: 404 Not Found', 404));

    const result = await deletePatientDocument(input);

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.delete).toHaveBeenCalledTimes(1);
  });

  it('still reports a Z3 server error as a 500', async () => {
    mockSearches();
    mockDeleteZ3Object.mockRejectedValue(new Z3Error('Delete request was not OK: 500 Internal Server Error', 500));

    const result = await deletePatientDocument(input);

    expect(result.statusCode).toBe(500);
    expect(mockOystehr.fhir.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when the DocumentReference does not exist', async () => {
    mockSearches({ docRefs: [] });

    const result = await deletePatientDocument(input);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
    expect(mockDeleteZ3Object).not.toHaveBeenCalled();
  });
});
