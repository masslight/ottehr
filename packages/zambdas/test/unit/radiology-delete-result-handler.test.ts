import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, List } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr, mockDeleteZ3Object } = vi.hoisted(() => ({
  mockOystehr: {
    fhir: {
      get: vi.fn(),
      search: vi.fn(),
      create: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  },
  mockDeleteZ3Object: vi.fn(),
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

vi.mock('../../src/shared/z3Utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    deleteZ3Object: mockDeleteZ3Object,
  };
});

vi.mock('@sentry/node-core/light', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    init: vi.fn(),
    isInitialized: vi.fn(() => true),
    setTag: vi.fn(),
    setTags: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  };
});

import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { RADIOLOGY_RESULT_DOC_REF_DOCTYPE } from 'utils/lib/fhir/radiology';
import { index as deleteRadiologyResultRaw } from '../../src/ehr/radiology/delete-result/index';

const deleteRadiologyResult = deleteRadiologyResultRaw as unknown as ZambdaHandler;

const DOC_REF_ID = 'result-doc-ref';
const Z3_URL = 'https://project-api.example.com/z3/project-1-patient-photos/patient-1/knee-xray.pdf';

const secrets = {
  AUTH0_ENDPOINT: 'https://auth.example.com',
  AUTH0_CLIENT: 'client',
  AUTH0_SECRET: 'secret',
  AUTH0_AUDIENCE: 'audience',
  FHIR_API: 'https://fhir.example.com',
  PROJECT_API: 'https://project-api.example.com',
  ENVIRONMENT: 'local',
};

const input: ZambdaInput = {
  headers: { Authorization: 'Bearer caller-token' },
  body: JSON.stringify({ documentReferenceId: DOC_REF_ID }),
  secrets,
};

const resultDocRef: DocumentReference = {
  resourceType: 'DocumentReference',
  id: DOC_REF_ID,
  status: 'current',
  type: {
    coding: [
      { system: 'http://loinc.org', code: '18748-4', display: 'Diagnostic imaging study' },
      RADIOLOGY_RESULT_DOC_REF_DOCTYPE,
    ],
  },
  subject: { reference: 'Patient/patient-1' },
  context: { related: [{ reference: 'ServiceRequest/service-request-1' }] },
  content: [{ attachment: { url: Z3_URL, title: 'knee-xray.pdf' } }],
};

const resultEntry = { item: { type: 'DocumentReference', reference: `DocumentReference/${DOC_REF_ID}` } };
const otherEntry = { item: { type: 'DocumentReference', reference: 'DocumentReference/other-doc-ref' } };

const makeRadiologyReportsFolder = (entry: List['entry']): List => ({
  resourceType: 'List',
  id: 'radiology-reports-folder',
  status: 'current',
  mode: 'working',
  title: BUCKET_NAMES.RADIOLOGY_REPORTS,
  subject: { reference: 'Patient/patient-1' },
  entry,
});

const mockFolders = (folders: List[]): void => {
  mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => folders });
};

describe('radiology-delete-result handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteZ3Object.mockResolvedValue(undefined);
    mockOystehr.fhir.patch.mockResolvedValue(undefined);
    mockOystehr.fhir.delete.mockResolvedValue(undefined);
  });

  it('removes the result from the Radiology Reports folder before deleting it', async () => {
    mockOystehr.fhir.get.mockResolvedValue(resultDocRef);
    mockFolders([makeRadiologyReportsFolder([otherEntry, resultEntry])]);

    const result = await deleteRadiologyResult(input);

    expect(result.statusCode).toBe(200);
    expect(mockDeleteZ3Object).toHaveBeenCalledWith(Z3_URL, 'mock-token');
    expect(mockOystehr.fhir.search).toHaveBeenCalledTimes(1);
    expect(mockOystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'List',
      params: [
        { name: 'subject', value: 'Patient/patient-1' },
        { name: 'title', value: BUCKET_NAMES.RADIOLOGY_REPORTS },
      ],
    });
    expect(mockOystehr.fhir.patch).toHaveBeenCalledTimes(1);
    expect(mockOystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'List',
      id: 'radiology-reports-folder',
      operations: [{ op: 'replace', path: '/entry', value: [otherEntry] }],
    });
    expect(mockOystehr.fhir.delete).toHaveBeenCalledWith({ resourceType: 'DocumentReference', id: DOC_REF_ID });
    expect(mockOystehr.fhir.patch.mock.invocationCallOrder[0]).toBeLessThan(
      mockOystehr.fhir.delete.mock.invocationCallOrder[0]
    );
  });

  it('deletes a result uploaded before folder filing without touching the folder', async () => {
    mockOystehr.fhir.get.mockResolvedValue({ ...resultDocRef, type: { coding: [RADIOLOGY_RESULT_DOC_REF_DOCTYPE] } });
    mockFolders([makeRadiologyReportsFolder([otherEntry])]);

    const result = await deleteRadiologyResult(input);

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.delete).toHaveBeenCalledWith({ resourceType: 'DocumentReference', id: DOC_REF_ID });
  });

  it('refuses a document that is not a radiology result and leaves the folders untouched', async () => {
    mockFolders([makeRadiologyReportsFolder([otherEntry, resultEntry])]);
    mockOystehr.fhir.get.mockResolvedValue({
      ...resultDocRef,
      type: { coding: [{ system: 'http://loinc.org', code: '18748-4' }] },
    });

    const result = await deleteRadiologyResult(input);

    expect(result.statusCode).toBe(500);
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.delete).not.toHaveBeenCalled();
  });

  it('deletes a legacy result for a patient that has no Radiology Reports folder', async () => {
    mockOystehr.fhir.get.mockResolvedValue({ ...resultDocRef, type: { coding: [RADIOLOGY_RESULT_DOC_REF_DOCTYPE] } });
    mockFolders([]);

    const result = await deleteRadiologyResult(input);

    expect(result.statusCode).toBe(200);
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.delete).toHaveBeenCalledWith({ resourceType: 'DocumentReference', id: DOC_REF_ID });
  });

  it('refuses a result without a patient subject before deleting anything', async () => {
    const { subject: _subject, ...resultWithoutSubject } = resultDocRef;
    mockOystehr.fhir.get.mockResolvedValue(resultWithoutSubject);

    const result = await deleteRadiologyResult(input);

    expect(result.statusCode).toBe(500);
    expect(mockDeleteZ3Object).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.search).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.patch).not.toHaveBeenCalled();
    expect(mockOystehr.fhir.delete).not.toHaveBeenCalled();
  });
});
